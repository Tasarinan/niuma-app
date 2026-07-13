import type { Editor, Range } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";

export interface CommandItem {
  title: string;
  description?: string;
  icon?: LucideIcon;
  tags?: string[];
  command?: (props: { editor: Editor; range: Range }) => void;
  disabled?: boolean;
}
