import type { Editor, Range } from "@tiptap/react";
import { memo, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CommandItem } from "./types";

interface Props {
  items: CommandItem[];
  editor: Editor;
  range: Range;
}

export const SlashCommandList = memo(function SlashCommandList({ items, editor, range }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    const navigationKeys = ["ArrowUp", "ArrowDown", "Enter", "Escape"];
    const onKeyDown = (event: KeyboardEvent) => {
      if (!navigationKeys.includes(event.key)) return;
      if (event.key === "Escape") {
        document.removeEventListener("keydown", onKeyDown, true);
        return;
      }

      event.preventDefault();
      if (!items.length) return;

      if (event.key === "Enter") {
        items[selectedIndex]?.command?.({ editor, range });
        return;
      }

      setSelectedIndex((index) => {
        const next = index + (event.key === "ArrowUp" ? -1 : 1);
        if (next < 0) return items.length - 1;
        if (next >= items.length) return 0;
        return next;
      });
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [selectedIndex, items, editor, range]);

  useEffect(() => {
    const selectedButton = listRef.current?.querySelector<HTMLButtonElement>(`[data-index="${selectedIndex}"]`);
    selectedButton?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedIndex]);

  return (
    <Card className="overflow-hidden rounded-xl border-slate-200 bg-white py-0 shadow-2xl">
      <ScrollArea className="py-2">
        <CardContent ref={listRef} className="max-h-80 w-72 p-0">
          {items.map((item, index) => (
            <Button
              key={item.title}
              variant="ghost"
              data-index={index}
              onClick={() => item.command?.({ editor, range })}
              className={cn(
                "h-auto w-full justify-start gap-3 rounded-none px-3 py-3 text-left hover:bg-slate-50",
                selectedIndex === index && "bg-slate-100 text-slate-950"
              )}
            >
              {item.icon ? <item.icon className="mt-0.5 size-4 shrink-0" /> : null}
              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.title}</span>
                {item.description ? <span className="block text-xs text-slate-500">{item.description}</span> : null}
              </span>
            </Button>
          ))}
        </CardContent>
      </ScrollArea>
    </Card>
  );
});
