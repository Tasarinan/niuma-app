import { Extension, ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { SlashCommandList } from "./SlashCommandList";
import { filterCommandItems, updateCommandMenuPosition } from "./slash-utils";
import type { CommandItem } from "./types";

type SlashCommandsOptions = {
  commandItems: CommandItem[];
};

export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: "slash-commands",

  addOptions() {
    return {
      commandItems: [] as CommandItem[],
    };
  },

  addProseMirrorPlugins() {
    const { commandItems } = this.options;
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        command: ({ editor: ed, range, props: commandProps }: { editor: import("@tiptap/core").Editor; range: import("@tiptap/core").Range; props: CommandItem }) => {
          commandProps?.command?.({ editor: ed, range });
        },
        items: ({ query }: { query: string }) => {
          return filterCommandItems(query || "", commandItems || []);
        },
        render: () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let component: ReactRenderer<any>;
          return {
            onStart: (props: SuggestionProps<CommandItem>) => {
              component = new ReactRenderer(SlashCommandList, {
                props: {
                  items: props.items,
                  editor: props.editor,
                  range: props.range,
                },
                editor: props.editor,
              });

              component.element.style.position = "absolute";
              document.body.appendChild(component.element);
              updateCommandMenuPosition(props.editor, component.element as HTMLElement);
            },
            onUpdate: (props: SuggestionProps<CommandItem>) => {
              component?.updateProps(props);
              updateCommandMenuPosition(props.editor, component.element as HTMLElement);
            },
            onKeyDown: ({ event }: { event: KeyboardEvent }) => {
              if (event.key === "Escape") {
                component?.destroy();
                component?.element.remove();
                return true;
              }
              return false;
            },
            onExit() {
              component?.destroy();
              component?.element.remove();
            },
          };
        },
        allow: ({ state, range }) => {
          const SLASH = "/";
          const $from = state.doc.resolve(range.from);
          const isRootDepth = $from.depth === 1;
          const isParagraph = $from.parent.type.name === "paragraph";
          const text = $from.parent.textContent;
          const isStartOfLine = text.charAt(0) === SLASH;
          const afterContent = text.substring(text.indexOf(SLASH));
          const isValidAfterContent = !afterContent.endsWith("  ");
          return isRootDepth && isParagraph && isStartOfLine && isValidAfterContent;
        },
      }),
    ];
  },
});
