import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components";
import { ToolbarButton } from "./ToolbarButton";
import { UseTimerReturn } from "@/hooks/useTimer";

const PRESETS = [
  { label: "5 min", seconds: 5 * 60 },
  { label: "10 min", seconds: 10 * 60 },
  { label: "15 min", seconds: 15 * 60 },
  { label: "25 min", seconds: 25 * 60 },
  { label: "30 min", seconds: 30 * 60 },
  { label: "45 min", seconds: 45 * 60 },
  { label: "60 min", seconds: 60 * 60 },
];

interface TimerButtonProps {
  timer: UseTimerReturn;
}

export function TimerButton({ timer }: TimerButtonProps) {
  const [open, setOpen] = useState(false);

  const indicatorColor = timer.isRunning
    ? timer.mode === "countdown"
      ? "bg-red-500"
      : "bg-green-500"
    : "bg-gray-400";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolbarButton
          active={timer.isRunning}
          activeColor={timer.mode === "countdown" ? "red" : "green"}
          indicator={timer.isRunning}
          indicatorColor={indicatorColor}
          title={`Timer (${timer.formatted})`}
          aria-label="Timer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </ToolbarButton>
      </PopoverTrigger>

      <PopoverContent
        className="w-56 p-3 space-y-3"
        side="bottom"
        align="start"
        sideOffset={8}
      >
        {/* Display */}
        <div className="text-center">
          <div className="text-2xl font-mono font-semibold tracking-tight text-[#18181b]">
            {timer.formatted}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {timer.mode === "stopwatch" ? "Stopwatch" : "Countdown"}
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-1.5 justify-center">
          {!timer.isRunning && timer.state !== "paused" && (
            <button
              onClick={() => timer.start()}
              className="flex-1 rounded-lg bg-[#18181b] text-white text-xs py-1.5 hover:bg-[#3f3f46] transition-colors"
            >
              Start
            </button>
          )}
          {timer.state === "paused" && (
            <button
              onClick={() => timer.start()}
              className="flex-1 rounded-lg bg-[#18181b] text-white text-xs py-1.5 hover:bg-[#3f3f46] transition-colors"
            >
              Resume
            </button>
          )}
          {timer.isRunning && (
            <button
              onClick={() => timer.pause()}
              className="flex-1 rounded-lg border border-[#e4e4e4] text-xs py-1.5 hover:bg-[#f7f7f7] transition-colors"
            >
              Pause
            </button>
          )}
          <button
            onClick={() => timer.reset()}
            className="flex-1 rounded-lg border border-[#e4e4e4] text-xs py-1.5 hover:bg-[#f7f7f7] transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Mode toggle */}
        <button
          onClick={() => timer.toggleMode()}
          className="w-full rounded-lg border border-[#e4e4e4] text-xs py-1.5 hover:bg-[#f7f7f7] transition-colors text-gray-600"
        >
          Switch to {timer.mode === "stopwatch" ? "Countdown" : "Stopwatch"}
        </button>

        {/* Countdown presets */}
        {timer.mode === "countdown" && (
          <div>
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">
              Presets
            </div>
            <div className="grid grid-cols-3 gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.seconds}
                  onClick={() => {
                    timer.setCountdown(p.seconds);
                    setOpen(false);
                  }}
                  className="rounded-md border border-[#e4e4e4] text-[11px] py-1 hover:bg-[#f7f7f7] transition-colors text-gray-700"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
