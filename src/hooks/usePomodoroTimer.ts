/**
 * usePomodoroTimer — Full Pomodoro timer hook for niuma-app.
 *
 * Mirrors niuma/src/stores/timerStore.ts logic ported to React.
 * Settings are persisted to localStorage under "niuma.pomodoro.settings".
 */
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PomodoroRound = "work" | "short-break" | "long-break" | "off";

export interface PomodoroSettings {
  timeWork: number;        // work duration in minutes
  timeShortBreak: number;  // short break in seconds
  timeLongBreak: number;   // long break in minutes
  workRounds: number;      // rounds before long break
  autoStartBreak: boolean;
  autoStartWork: boolean;
  alertSounds: boolean;
  tickSounds: boolean;
  tickSoundsDuringBreak: boolean;
  volume: number;          // 0–100
  fullscreenBreak: boolean;
}

export interface UsePomodoroTimerReturn {
  // Runtime state
  currentRound: PomodoroRound;
  round: number;           // current round index (1-based)
  totalWorkRounds: number; // total completed work rounds
  timeRemaining: number;   // seconds remaining
  totalTime: number;       // total seconds for current session
  isRunning: boolean;
  timerStarted: boolean;
  // Settings
  settings: PomodoroSettings;
  updateSettings: (patch: Partial<PomodoroSettings>) => void;
  // Actions
  startTimer: (round: PomodoroRound) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  stopTimer: () => void;
  skipTimer: () => void;
  resetDefaults: () => void;
  // Formatted display
  formattedTime: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: PomodoroSettings = {
  timeWork: 25,
  timeShortBreak: 60,
  timeLongBreak: 15,
  workRounds: 4,
  autoStartBreak: false,
  autoStartWork: false,
  alertSounds: true,
  tickSounds: false,
  tickSoundsDuringBreak: false,
  volume: 100,
  fullscreenBreak: false,
};

const SETTINGS_KEY = "niuma.pomodoro.settings";

function loadSettings(): PomodoroSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<PomodoroSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: PomodoroSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ─── Audio ────────────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(freq: number, duration: number, vol: number) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol * 0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch { /* ignore */ }
}

function playTick(vol: number) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 800;
    gain.gain.value = vol * 0.08;
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch { /* ignore */ }
}

function playWorkAlert(vol: number) {
  playTone(523.25, 0.2, vol);
  setTimeout(() => playTone(659.25, 0.3, vol), 200);
}

function playShortBreakAlert(vol: number) {
  playTone(523.25, 0.15, vol);
  setTimeout(() => playTone(659.25, 0.15, vol), 150);
  setTimeout(() => playTone(783.99, 0.2, vol), 300);
}

function playLongBreakAlert(vol: number) {
  playTone(392.0, 0.3, vol);
  setTimeout(() => playTone(493.88, 0.3, vol), 100);
  setTimeout(() => playTone(587.33, 0.4, vol), 200);
}

function formatSeconds(seconds: number): string {
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.abs(seconds) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePomodoroTimer(): UsePomodoroTimerReturn {
  const [settings, setSettings] = useState<PomodoroSettings>(loadSettings);
  const [currentRound, setCurrentRound] = useState<PomodoroRound>("off");
  const [round, setRound] = useState(1);
  const [totalWorkRounds, setTotalWorkRounds] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);

  // Keep settings ref in sync so interval callback always reads latest.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Helpers ---

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const clearAutoStart = useCallback(() => {
    if (autoStartRef.current !== null) {
      clearTimeout(autoStartRef.current);
      autoStartRef.current = null;
    }
  }, []);

  const roundSeconds = useCallback((r: PomodoroRound, s: PomodoroSettings): number => {
    if (r === "work") return s.timeWork * 60;
    if (r === "short-break") return s.timeShortBreak;
    if (r === "long-break") return s.timeLongBreak * 60;
    return 0;
  }, []);

  // --- Core timer ---

  const onComplete = useCallback((completedRound: PomodoroRound) => {
    clearTick();
    setIsRunning(false);
    setTimerStarted(false);
    setCurrentRound("off");

    const s = settingsRef.current;
    const vol = s.volume / 100;

    if (s.alertSounds) {
      if (completedRound === "work") playWorkAlert(vol);
      else if (completedRound === "short-break") playShortBreakAlert(vol);
      else if (completedRound === "long-break") playLongBreakAlert(vol);
    }

    if (completedRound === "work") {
      setTotalWorkRounds((prev) => prev + 1);

      setRound((prevRound) => {
        const nextRound = prevRound >= s.workRounds ? 1 : prevRound + 1;
        const nextBreak = prevRound >= s.workRounds ? "long-break" : "short-break";

        if (s.autoStartBreak) {
          autoStartRef.current = setTimeout(() => {
            startTimerInner(nextBreak);
          }, 1500);
        }

        return nextRound;
      });
    } else {
      if (s.autoStartWork) {
        autoStartRef.current = setTimeout(() => {
          startTimerInner("work");
        }, 1500);
      }
    }
  // startTimerInner is defined below; safe to call via ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTick]);

  // Use a ref for onComplete so the interval closure doesn't go stale.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const startTimerInner = useCallback((roundType: PomodoroRound) => {
    if (roundType === "off") return;
    clearTick();
    clearAutoStart();

    const s = settingsRef.current;
    const secs = roundSeconds(roundType, s);

    setCurrentRound(roundType);
    setTimerStarted(true);
    setIsRunning(true);
    setTotalTime(secs);
    setTimeRemaining(secs);

    let remaining = secs;
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        setTimeRemaining(0);
        onCompleteRef.current(roundType);
      } else {
        setTimeRemaining(remaining);
        // Tick sound
        const ss = settingsRef.current;
        const isBreak = roundType === "short-break" || roundType === "long-break";
        if (ss.tickSounds && !isBreak) playTick(ss.volume / 100);
        if (ss.tickSoundsDuringBreak && isBreak) playTick(ss.volume / 100);
      }
    }, 1000);
  }, [clearTick, clearAutoStart, roundSeconds]);

  // Expose startTimerInner via ref so onComplete can call it without circular dep.
  const startTimerInnerRef = useRef(startTimerInner);
  startTimerInnerRef.current = startTimerInner;

  // --- Public API ---

  const startTimer = useCallback((r: PomodoroRound) => {
    startTimerInnerRef.current(r);
  }, []);

  const pauseTimer = useCallback(() => {
    clearTick();
    setIsRunning(false);
  }, [clearTick]);

  const resumeTimer = useCallback(() => {
    if (!timerStarted || timeRemaining <= 0) return;

    setIsRunning(true);
    let remaining = timeRemaining;
    const roundType = currentRound;
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        setTimeRemaining(0);
        onCompleteRef.current(roundType);
      } else {
        setTimeRemaining(remaining);
        const ss = settingsRef.current;
        const isBreak = roundType === "short-break" || roundType === "long-break";
        if (ss.tickSounds && !isBreak) playTick(ss.volume / 100);
        if (ss.tickSoundsDuringBreak && isBreak) playTick(ss.volume / 100);
      }
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTick, timerStarted, timeRemaining, currentRound]);

  const resetTimer = useCallback(() => {
    if (!timerStarted) return;
    clearTick();
    setIsRunning(false);
    setTimeRemaining(totalTime);
  }, [clearTick, timerStarted, totalTime]);

  const stopTimer = useCallback(() => {
    clearTick();
    clearAutoStart();
    setIsRunning(false);
    setTimerStarted(false);
    setCurrentRound("off");
    setTimeRemaining(0);
    setTotalTime(0);
  }, [clearTick, clearAutoStart]);

  const skipTimer = useCallback(() => {
    const r = currentRound;
    stopTimer();
    onCompleteRef.current(r);
  }, [currentRound, stopTimer]);

  const updateSettings = useCallback((patch: Partial<PomodoroSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetDefaults = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { clearTick(); clearAutoStart(); }, [clearTick, clearAutoStart]);

  const formattedTime = formatSeconds(timeRemaining);

  return {
    currentRound,
    round,
    totalWorkRounds,
    timeRemaining,
    totalTime,
    isRunning,
    timerStarted,
    settings,
    updateSettings,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    stopTimer,
    skipTimer,
    resetDefaults,
    formattedTime,
  };
}
