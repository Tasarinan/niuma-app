import type { MouseEvent } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  previewUrlTransform,
  resolvePreviewImageSrc,
} from "@/lib/artifact/markdown-images";
import { themeStylesToScopedCss } from "@/lib/wechat/format-theme-css";
import {
  replaceStructureFences,
  structureBlockToPreviewHtml,
} from "@/lib/wechat/structure-blocks";

type Props = {
  markdown: string;
  themeId: string;
  styles: Record<string, string> | null;
  articlePath?: string;
};

const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "section"],
  protocols: {
    ...(defaultSchema.protocols ?? {}),
    src: [...(defaultSchema.protocols?.src ?? ["http", "https"]), "data", "blob", "asset", "tauri"],
  },
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    section: ["className", "class", "dataStructure", "style"],
    div: [...(defaultSchema.attributes?.div ?? []), "className", "class", "style"],
    span: [...(defaultSchema.attributes?.span ?? []), "className", "class", "style"],
    ol: [...(defaultSchema.attributes?.ol ?? []), "className", "class", "style"],
    ul: [...(defaultSchema.attributes?.ul ?? []), "className", "class", "style"],
    li: [...(defaultSchema.attributes?.li ?? []), "className", "class", "style"],
    p: [...(defaultSchema.attributes?.p ?? []), "className", "class", "style"],
    h1: [...(defaultSchema.attributes?.h1 ?? []), "style"],
    h2: [...(defaultSchema.attributes?.h2 ?? []), "style"],
    h3: [...(defaultSchema.attributes?.h3 ?? []), "style"],
    h4: [...(defaultSchema.attributes?.h4 ?? []), "style"],
    h5: [...(defaultSchema.attributes?.h5 ?? []), "style"],
    h6: [...(defaultSchema.attributes?.h6 ?? []), "style"],
    table: [...(defaultSchema.attributes?.table ?? []), "style"],
    blockquote: [...(defaultSchema.attributes?.blockquote ?? []), "style"],
    pre: [...(defaultSchema.attributes?.pre ?? []), "style"],
    hr: [...(defaultSchema.attributes?.hr ?? []), "style"],
    img: [...(defaultSchema.attributes?.img ?? []), "style"],
  },
};

export function WechatThemePreview({ markdown, themeId, styles, articlePath }: Props) {
  const scope = `.wechat-theme-preview[data-theme="${themeId.replace(/[^a-z0-9_-]/gi, "")}"]`;
  const css = styles
    ? themeStylesToScopedCss(scope, styles)
    : `${scope} img { max-width: 100%; height: auto; display: block; }`;
  const previewMarkdown = replaceStructureFences(markdown, structureBlockToPreviewHtml);

  return (
    <section
      className="wechat-theme-preview overflow-hidden rounded-lg shadow-sm bg-white"
      data-theme={themeId}
    >
      <style>{css}</style>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, SANITIZE_SCHEMA]]}
        urlTransform={previewUrlTransform}
        components={{
          a: ({ node: _node, href, children, ...props }) => {
            const handleClick = async (event: MouseEvent) => {
              event.preventDefault();
              if (!href) return;
              try {
                await openUrl(href);
              } catch {
                // ignore
              }
            };
            return (
              <a {...props} href={href} onClick={handleClick}>
                {children}
              </a>
            );
          },
          img: ({ node: _node, src, alt, ...props }) => {
            const resolved = resolvePreviewImageSrc(src ?? "", articlePath, convertFileSrc);
            if (!resolved) return null;
            return <img {...props} src={resolved} alt={alt ?? ""} />;
          },
        }}
      >
        {previewMarkdown}
      </ReactMarkdown>
    </section>
  );
}
