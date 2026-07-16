import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSTT } from "@/lib";
import { extractVideoKeyPoints } from "@/lib/functions/video-keypoint-extractor";
import { useApp } from "@/store";
import type { VideoInsightsStage, VideoKeyPoint, VideoTranscriptSegment } from "@/types";

// Audio is captured in real-time via MediaRecorder while the video plays back
// (browsers can't reliably decodeAudioData() a muxed video container), so we
// chunk it into fixed intervals and transcribe each chunk as it becomes available.
const CHUNK_DURATION_MS = 20_000;

export function useVideoInsights() {
  const {
    selectedSttProvider,
    allSttProviders,
    sttLanguage,
    selectedAIProvider,
    allAiProviders,
  } = useApp();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkStartTimeRef = useRef(0);
  const transcriptSegmentsRef = useRef<VideoTranscriptSegment[]>([]);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [stage, setStage] = useState<VideoInsightsStage>("idle");
  const [progress, setProgress] = useState(0);
  const [transcriptSegments, setTranscriptSegments] = useState<VideoTranscriptSegment[]>([]);
  const [keyPoints, setKeyPoints] = useState<VideoKeyPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [onlyPlayKeyPoints, setOnlyPlayKeyPoints] = useState(false);

  const keyPointsRef = useRef<VideoKeyPoint[]>([]);
  useEffect(() => {
    keyPointsRef.current = keyPoints;
  }, [keyPoints]);

  const loadVideo = useCallback((file: File) => {
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setVideoFileName(file.name);
    setStage("idle");
    setProgress(0);
    setTranscriptSegments([]);
    transcriptSegmentsRef.current = [];
    setKeyPoints([]);
    setError(null);
    setOnlyPlayKeyPoints(false);
  }, []);

  const transcribeChunk = useCallback(
    async (blob: Blob, start: number, end: number) => {
      try {
        const sttProviderConfig = allSttProviders.find((p) => p.id === selectedSttProvider.provider);
        const text = await fetchSTT({
          provider: sttProviderConfig,
          selectedProvider: selectedSttProvider,
          audio: blob,
          language: sttLanguage,
        });

        if (text?.trim()) {
          const segment: VideoTranscriptSegment = { start, end, text: text.trim() };
          transcriptSegmentsRef.current = [...transcriptSegmentsRef.current, segment];
          setTranscriptSegments(transcriptSegmentsRef.current);
        }
      } catch (err) {
        console.error("[VideoInsights] Chunk transcription failed:", err);
      }
    },
    [allSttProviders, selectedSttProvider, sttLanguage]
  );

  const stopAnalysis = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    videoRef.current?.pause();
  }, []);

  const analyze = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setKeyPoints([]);
    setTranscriptSegments([]);
    transcriptSegmentsRef.current = [];
    setStage("transcribing");
    setProgress(0);

    try {
      const captureStream =
        (video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream })
          .captureStream ||
        (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream;

      if (!captureStream) {
        throw new Error("This browser does not support capturing video audio for analysis.");
      }

      const stream = captureStream.call(video);
      streamRef.current = stream;

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("This video has no audio track to transcribe.");
      }
      const audioOnlyStream = new MediaStream(audioTracks);

      const recorder = new MediaRecorder(audioOnlyStream);
      mediaRecorderRef.current = recorder;
      chunkStartTimeRef.current = video.currentTime;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const start = chunkStartTimeRef.current;
          const end = video.currentTime;
          chunkStartTimeRef.current = end;
          void transcribeChunk(event.data, start, end);
        }
      };

      const finishAnalysis = async () => {
        // Give the final ondataavailable event a moment to fire after stop().
        await new Promise((resolve) => setTimeout(resolve, 300));

        setStage("extracting");
        try {
          const providerConfig = {
            provider: allAiProviders.find((p) => p.id === selectedAIProvider.provider),
            selectedProvider: selectedAIProvider,
          };
          const result = await extractVideoKeyPoints(transcriptSegmentsRef.current, providerConfig);
          setKeyPoints(result ?? []);
          setStage("done");
        } catch (err) {
          console.error("[VideoInsights] Key point extraction failed:", err);
          setError("Failed to extract key points from this video.");
          setStage("error");
        }
      };

      const handleEnded = () => {
        if (recorder.state !== "inactive") recorder.stop();
        video.removeEventListener("ended", handleEnded);
        void finishAnalysis();
      };

      const handleTimeUpdate = () => {
        if (video.duration > 0) {
          setProgress(video.currentTime / video.duration);
        }
      };

      video.addEventListener("ended", handleEnded);
      video.addEventListener("timeupdate", handleTimeUpdate);

      recorder.start(CHUNK_DURATION_MS);
      video.currentTime = 0;
      await video.play();
    } catch (err) {
      console.error("[VideoInsights] Analysis failed:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze this video.");
      setStage("error");
    }
  }, [transcribeChunk, allAiProviders, selectedAIProvider]);

  const jumpToKeyPoint = useCallback((keyPoint: VideoKeyPoint) => {
    if (videoRef.current) {
      videoRef.current.currentTime = keyPoint.start;
      void videoRef.current.play();
    }
  }, []);

  // "Only play key points" mode: once playback passes a key point's end time,
  // skip forward to the next key point's start instead of playing the gap.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onlyPlayKeyPoints) return;

    const handleTimeUpdate = () => {
      const points = keyPointsRef.current;
      if (points.length === 0) return;

      const current = points.find((kp) => video.currentTime >= kp.start && video.currentTime < kp.end);
      if (current) return;

      const next = points.find((kp) => kp.start > video.currentTime);
      if (next) {
        video.currentTime = next.start;
      } else {
        video.pause();
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [onlyPlayKeyPoints]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    videoRef,
    videoUrl,
    videoFileName,
    stage,
    progress,
    transcriptSegments,
    keyPoints,
    error,
    onlyPlayKeyPoints,
    setOnlyPlayKeyPoints,
    loadVideo,
    analyze,
    stopAnalysis,
    jumpToKeyPoint,
  };
}
