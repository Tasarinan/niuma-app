import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  activeColor?: "red" | "green" | "blue" | "amber";
  indicator?: boolean; // pulsing dot indicator
  indicatorColor?: string;
  children: ReactNode;
}

const activeColorMap: Record<string, string> = {
  red: "border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
  green: "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
  blue: "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100",
  amber: "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100",
};

/**
 * Compact icon button for the main toolbar.
 * Matches niuma Vue Main.vue .toolbar-icon-button style.
 */
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      active = false,
      activeColor = "blue",
      indicator = false,
      indicatorColor = "bg-red-500",
      children,
      className = "",
      ...props
    },
    ref
  ) => {
    const base =
      "relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:pointer-events-none disabled:opacity-40";
    const idle =
      "border-[#e4e4e4] bg-[#f7f7f7] text-[#3f3f46] hover:border-[#d7d7d7] hover:bg-[#eeeeee] hover:text-[#18181b] active:translate-y-px";
    const activeClass = active ? activeColorMap[activeColor] ?? activeColorMap.blue : idle;

    return (
      <button ref={ref} className={`${base} ${activeClass} ${className}`} {...props}>
        {children}
        {indicator && (
          <span
            className={`absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full ${indicatorColor} animate-pulse`}
          />
        )}
      </button>
    );
  }
);

ToolbarButton.displayName = "ToolbarButton";
