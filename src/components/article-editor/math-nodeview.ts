import type { Node } from "@tiptap/pm/model";
import type { NodeView } from "@tiptap/pm/view";
import type { Editor, NodeViewRendererProps } from "@tiptap/react";
import { render } from "katex";
import "katex/dist/katex.min.css";

export default class MathNodeView implements NodeView {
  renderer!: HTMLElement;
  content!: HTMLElement | null;
  editor!: Editor;
  node!: Node;
  getPos!: () => number | undefined;
  showSource!: boolean;
  type: string;
  isInline: boolean;
  private handleClick: () => void;
  private boundHandleSelectionUpdate: () => void;

  constructor(props: NodeViewRendererProps, isInline = false) {
    this.editor = props.editor;
    this.node = props.node;
    this.getPos = props.getPos;
    this.showSource = this.node.attrs.showSource;
    this.type = isInline ? "math-inline" : "math-display";
    this.isInline = isInline;
    this.handleClick = () => this.selectNode();
    this.boundHandleSelectionUpdate = this.handleSelectionUpdate.bind(this);
    this.mount();
  }

  mount() {
    const elementTag = this.isInline ? "span" : "div";
    const dom = document.createElement(elementTag);
    const source = document.createElement(elementTag);
    const katexNode = document.createElement(elementTag);

    source.textContent = this.node.textContent;
    source.classList.add("math-content");
    if (!source.innerText.trim()) source.classList.add("math-content-empty");

    dom.append(source);
    dom.classList.add("math", this.type);

    katexNode.setAttribute("contentEditable", "false");
    render(this.node.textContent, katexNode, {
      displayMode: !this.isInline,
      throwOnError: false,
    });
    dom.append(katexNode);
    dom.addEventListener("click", this.handleClick);

    if (!this.showSource || !this.editor.isEditable) {
      dom.setAttribute("draggable", "true");
      source.setAttribute("style", "opacity:0;overflow:hidden;position:absolute;width:0;height:0;");
    } else {
      dom.classList.add("math-selected");
      dom.addEventListener("dragstart", (event) => event.preventDefault());
      if (this.isInline) {
        katexNode.setAttribute("style", "opacity:0;overflow:hidden;position:absolute;width:0;height:0;");
      }
    }

    this.editor.on("selectionUpdate", this.boundHandleSelectionUpdate);
    this.renderer = dom;
    this.content = source;
  }

  get dom() {
    return this.renderer;
  }

  get contentDOM() {
    return this.content;
  }

  handleSelectionUpdate() {
    const pos = this.getPos();
    if (pos == undefined) return;
    const { from, to } = this.editor.state.selection;

    if (from >= pos && to <= pos + this.node.nodeSize) {
      if (!this.showSource) this.selectNode();
    } else if (this.showSource) {
      this.deselectNode();
    }
  }

  selectNode() {
    const pos = this.getPos();
    if (pos == undefined) return;
    const nodeAfter = this.editor.state.tr.doc.resolve(pos).nodeAfter;
    if (nodeAfter?.type.name !== this.type && !this.showSource) return;

    this.editor.chain().command(({ tr }) => {
      tr.setNodeAttribute(pos, "showSource", true);
      return true;
    }).run();
  }

  deselectNode() {
    const pos = this.getPos();
    if (pos == undefined) return;

    if (!this.node.textContent.trim()) {
      this.editor.commands.command(({ tr }) => {
        tr.delete(pos, pos + this.node.nodeSize);
        return true;
      });
      return;
    }

    this.editor.commands.command(({ tr }) => {
      tr.setNodeAttribute(pos, "showSource", false);
      return true;
    });
  }

  update() {
    return false;
  }

  destroy() {
    this.renderer.removeEventListener("click", this.handleClick);
    this.editor.off("selectionUpdate", this.boundHandleSelectionUpdate);
    this.content = null;
  }

  stopEvent() {
    return !!this.renderer.getAttribute("draggable");
  }
}
