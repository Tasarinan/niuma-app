import { useState, useEffect, useRef, useCallback } from "react";

export type TimerMode = "stopwatch" | "countdown";
export type TimerState = "idle" | "running" | "paused";

export interface UseTimerReturn {
  mode: TimerMode;
  state: TimerState;
  elapsed: number; // seconds elapsed (stopwatch) or seconds remaining (countdown)
  countdownTotal: number; // total countdown seconds set by user
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setCountdown: (seconds: number) => void;
  toggleMode: () => void;
  formatted: string; // "MM:SS" display string
}

function formatSeconds(seconds: number): string {
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.abs(seconds) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function useTimer(): UseTimerReturn {
  const [mode, setMode] = useState<TimerMode>("stopwatch");
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [countdownTotal, setCountdownTotal] = useState(25 * 60); // 25 min default
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearInterval_ = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    setTimerState("running");
  }, []);

  const pause = useCallback(() => {
    setTimerState((s) => (s === "running" ? "paused" : s));
  }, []);

  const reset = useCallback(() => {
    clearInterval_();
    setTimerState("idle");
    setElapsed(0);
  }, [clearInterval_]);

  const setCountdown = useCallback((seconds: number) => {
    setCountdownTotal(seconds);
    setElapsed(0);
    setTimerState("idle");
  }, []);

  const toggleMode = useCallback(() => {
    clearInterval_();
    setMode((m) => (m === "stopwatch" ? "countdown" : "stopwatch"));
    setTimerState("idle");
    setElapsed(0);
  }, [clearInterval_]);

  useEffect(() => {
    if (timerState === "running") {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (mode === "countdown") {
            const next = prev + 1;
            if (next >= countdownTotal) {
              setTimerState("idle");
              return countdownTotal;
            }
            return next;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      clearInterval_();
    }
    return clearInterval_;
  }, [timerState, mode, countdownTotal, clearInterval_]);

  const displaySeconds =
    mode === "countdown" ? Math.max(0, countdownTotal - elapsed) : elapsed;

  return {
    mode,
    state: timerState,
    elapsed,
    countdownTotal,
    isRunning: timerState === "running",
    start,
    pause,
    reset,
    setCountdown,
    toggleMode,
    formatted: formatSeconds(displaySeconds),
  };
}
