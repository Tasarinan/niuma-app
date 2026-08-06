import re, sys

path = "TranscriptFeed.tsx"
content = open(path, encoding="utf-8").read()

old = (
    'export function TranscriptFeed({\n'
    '  transcript,\n'
    '  clearTranscript,\n'
    '  assignSpeaker,\n'
    '  onSave,\n'
    '}: {\n'
    '  transcript: TranscriptEntry[];\n'
    '  clearTranscript: () => void;\n'
    '  assignSpeaker: (speakerId: string, label: string, profileId?: string) => void;\n'
    '  onSave?: () => void;\n'
    '}) {'
)

new = (
    'export function TranscriptFeed({\n'
    '  transcript,\n'
    '  clearTranscript,\n'
    '  assignSpeaker,\n'
    '  onSave,\n'
    '  isRecording = false,\n'
    '  micListening = false,\n'
    '  micUserSpeaking = false,\n'
    '}: {\n'
    '  transcript: TranscriptEntry[];\n'
    '  clearTranscript: () => void;\n'
    '  assignSpeaker: (speakerId: string, label: string, profileId?: string) => void;\n'
    '  onSave?: () => void;\n'
    '  isRecording?: boolean;\n'
    '  micListening?: boolean;\n'
    '  micUserSpeaking?: boolean;\n'
    '}) {'
)

if old not in content:
    print("ERROR: old signature not found")
    sys.exit(1)

content = content.replace(old, new, 1)
print("Signature replaced OK")

# Now replace the empty state block
old_empty = (
    '  if (transcript.length === 0) {\n'
    '    return (\n'
    '      <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400">\n'
    '        <p className="text-sm font-semibold text-slate-500">\u4f1a\u8bae\u8f6c\u5f55\u5c1a\u672a\u5f00\u59cb</p>\n'
    '        <p className="text-xs">\u70b9\u51fb\u9876\u90e8\u201c\u5f00\u59cb\u4f1a\u8bae\u201d\u6309\u9215\uff0c\u5b9e\u65f6\u8f6c\u5f55\u5c06\u663e\u793a\u5728\u8fd9\u91cc</p>\n'
    '      </div>\n'
    '    );\n'
    '  }'
)

new_empty = (
    '  if (transcript.length === 0) {\n'
    '    if (isRecording) {\n'
    '      return (\n'
    '        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-slate-50">\n'
    '          <div className="relative flex items-center justify-center">\n'
    '            <span\n'
    '              className={cn(\n'
    '                "absolute inline-flex size-14 rounded-full opacity-30",\n'
    '                micUserSpeaking\n'
    '                  ? "animate-ping bg-indigo-500"\n'
    '                  : "animate-pulse bg-slate-300",\n'
    '              )}\n'
    '            />\n'
    '            <span\n'
    '              className={cn(\n'
    '                "relative flex size-10 items-center justify-center rounded-full",\n'
    '                micUserSpeaking\n'
    '                  ? "bg-indigo-600"\n'
    '                  : micListening\n'
    '                    ? "bg-slate-400"\n'
    '                    : "bg-slate-300",\n'
    '              )}\n'
    '            >\n'
    '              <Mic className="size-4 text-white" />\n'
    '            </span>\n'
    '          </div>\n'
    '          <div className="text-center">\n'
    '            <p className="text-sm font-semibold text-slate-600">\n'
    '              {micUserSpeaking ? "\u6b63\u5728\u8bc6\u522b\u8bed\u97f3\u2026" : micListening ? "\u6b63\u5728\u76d1\u542c\u2026" : "\u5f55\u97f3\u4e2d"}\n'
    '            </p>\n'
    '            <p className="mt-1 text-xs text-slate-400">\n'
    '              {micListening\n'
    '                ? "\u8bf7\u5f00\u59cb\u8bf4\u8bdd\uff0c\u8f6c\u5f55\u5185\u5bb9\u5c06\u5728\u8fd9\u91cc\u5b9e\u65f6\u663e\u793a"\n'
    '                : "\u8bed\u97f3\u8bc6\u522b\u670d\u52a1\u8fde\u63a5\u4e2d\uff0c\u8bf7\u7a0d\u5019\u2026"}\n'
    '            </p>\n'
    '          </div>\n'
    '        </div>\n'
    '      );\n'
    '    }\n'
    '    return (\n'
    '      <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400">\n'
    '        <p className="text-sm font-semibold text-slate-500">\u4f1a\u8bae\u8f6c\u5f55\u5c1a\u672a\u5f00\u59cb</p>\n'
    '        <p className="text-xs">\u70b9\u51fb\u9876\u90e8\u201c\u5f00\u59cb\u4f1a\u8bae\u201d\u6309\u9215\uff0c\u5b9e\u65f6\u8f6c\u5f55\u5c06\u663e\u793a\u5728\u8fd9\u91cc</p>\n'
    '      </div>\n'
    '    );\n'
    '  }'
)

if old_empty not in content:
    print("ERROR: old empty state not found")
    # print a snippet for debugging
    idx = content.find('if (transcript.length === 0)')
    print("Found empty check at:", idx)
    print(repr(content[idx:idx+300]))
    sys.exit(1)

content = content.replace(old_empty, new_empty, 1)
print("Empty state replaced OK")

open(path, "w", encoding="utf-8").write(content)
print("File saved.")
