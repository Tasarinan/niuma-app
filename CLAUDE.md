# CLAUDE.md - Niuma Project Guide

This file gives AI coding assistants the current project map and development rules for the Niuma codebase.

## Project Overview

Niuma is a local-first Tauri desktop app that positions AI as your invisible private team. The app provides a transparent toolbar, a floating multi-agent workbench, and configurable specialist teams for daily work such as health, meetings, creation, and study.

The name comes from the Chinese workplace self-joke "牛马" (niuma): a workhorse doing the hard, repetitive labor. NIUMA-APP turns that into a product idea: users customize their own virtual "niuma team" and direct those agents to handle routine work.



- Version: 0.5.0
- Product name: Niuma
- Package name: `niuma-app`
- Tauri crate: `niuma`
- License: GPL-3.0
- Repository: `https://github.com/Tasarinan/niuma-app`
- Website: `https://niuma-app.com`
- Platforms: Windows, macOS, Linux

## Tech Stack

### Frontend

- React 19 + TypeScript 5.8
- Vite 7
- Tailwind CSS 4
- Radix UI / shadcn-style local UI components
- React Router 7
- Zustand for app state
- i18next / react-i18next for localization
- TipTap for article editing
- Vitest for tests

### Desktop Backend

- Tauri 2 + Rust 2021
- SQLite through `tauri-plugin-sql`
- Store through `tauri-plugin-store`
- HTTP through `tauri-plugin-http` and Rust `reqwest`
- Global shortcuts through `tauri-plugin-global-shortcut`
- Autostart, updater, opener, shell, keychain, PostHog, and machine UID plugins
- Platform audio/capture support with `cpal`, `wasapi`, PulseAudio bindings, `xcap`, and macOS private APIs

### Agent Runtime

- `@earendil-works/pi-agent-core` and `@earendil-works/pi-ai`
- Direct provider runtime in `src/lib/agent`
- Skills loaded from `.teams` and user preferences
- MCP tools bridged through the runtime
- File and database backed context memory

## Development Commands

```bash
npm install
npm run dev
npm run type-check
npm run lint
npm run test
npm run build
npm run tauri dev
npm run tauri build
```

Windows helper scripts also exist at the repo root:

```bash
dev.bat
build.bat
stop.bat
```

## Current Project Structure

```text
niuma-app/
├── .teams/                         # Built-in teams, agents, commands, and skills
│   ├── health/
│   ├── meeting/
│   ├── content/
│   └── study/
├── .artifacts/                     # Drafts, screenshots, and transcripts (gitignored)
├── docs/                           # Project docs and feature notes
├── src/
│   ├── main.tsx                    # Window-aware React entrypoint
│   ├── global.css                  # Tailwind/theme globals
│   ├── components/                 # Shared UI, layouts, toolbar, bootstrap
│   │   ├── ui/                     # Local shadcn-style primitives
│   │   ├── layouts/                # Dashboard/Page layouts
│   │   ├── toolbar/                # Transparent toolbar UI
│   │   ├── Markdown/               # Markdown renderer
│   │   ├── Contribute.tsx          # Support card: add new teams
│   │   └── Promote.tsx             # Support card: promote / sponsor
│   ├── config/                     # Storage keys, defaults, provider constants
│   ├── hooks/                      # App, audio, shortcut, chat, and utility hooks
│   ├── i18n/                       # Navigation/common locale files
│   ├── lib/
│   │   ├── agent/                  # Pi runtime, providers, tools, memory, workbench defaults
│   │   ├── database/               # SQLite actions
│   │   ├── functions/              # AI/STT/context/health/IMA functions
│   │   ├── providers/              # Provider registry and connection helpers
│   │   ├── routes/                 # React Router config
│   │   ├── slash-commands/         # Slash command parsing
│   │   └── storage/                # localStorage/plugin-store helpers
│   ├── pages/                      # Route components
│   ├── store/                      # Zustand stores
│   ├── tests/                      # Vitest tests
│   └── types/                      # Shared TypeScript types
├── src-tauri/
│   ├── src/                        # Rust commands and modules
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Routes And Windows

`src/main.tsx` renders different React roots based on the Tauri window label:

- `capture-overlay-*`: renders `Overlay` directly for screenshot capture.
- `agent-chat`: renders the standalone `AgentChat` window with providers.
- all other labels: render `AppRoutes`.

Current routes live in `src/lib/routes/index.tsx`:

| Path | Component | Notes |
| --- | --- | --- |
| `/` | `App` | Transparent toolbar / primary overlay surface |
| `/agent-chat` | `AgentChat` | Full-bleed multi-agent workbench |
| `/dashboard` | `Dashboard` | App landing page, links, support cards |
| `/pomodoro` | `Pomodoro` | Timer workflow |
| `/shortcuts` | `Shortcuts` | Global shortcut settings |
| `/screenshot` | `Screenshot` | Screenshot settings |
| `/settings` | `Settings` | App settings and customization |
| `/audio` | `Audio` | Audio device configuration |
| `/responses` | `Responses` | Response length/language preferences |
| `/providers` | `Providers` | AI provider, zero-token, and custom provider setup |
| `/agents` | `Agents` | Agent catalog and hired agents |
| `/skills` | `Skills` | Skill preferences |
| `/cost-tracking` | `CostTracking` | Usage and cost tracking |
| `/context-memory` | `ContextMemory` | Team memory and context settings |
| `/speakers` | `Speakers` | STT and speaker diarization configuration |

When adding a page, update:

1. `src/pages/<page>/index.tsx`
2. `src/pages/index.ts`
3. `src/lib/routes/index.tsx`
4. `src/hooks/useMenuItems.tsx`
5. locale files under `src/i18n/locales/*/navigation.json` if the menu label is translated

## Built-In Teams

Teams are defined under `.teams/<team>/config.yaml` with roster fields plus agents, commands, and skills. Runtime defaults are mirrored in `src/lib/agent/workbench-defaults.ts`.

| Team | Kind | Default Agent | Default Command | Purpose |
| --- | --- | --- | --- | --- |
| `health` | chat | `guide` | `/record` | Personal/family health records, report analysis, nutrition, sleep, mental health, chronic care |
| `meeting` | meeting | `facilitator` | `/capture` | Agenda preparation, live capture, key points, action items, summaries, follow-up messages |
| `content` | chat | `aria` | `/draft` | Content planning, writing, polishing, adaptation, brand copy, WeChat article pipeline |
| `study` | chat | `tutor` | `/ask` | English grammar, vocabulary, reading, sentence analysis, writing coaching |

Team folders normally contain:

- `config.yaml` for roster and team metadata
- `agents/*.md` for agent definitions
- `commands/*.md` for slash commands
- `skills/*/SKILL.md` for team-specific skills

Adding or renaming a built-in team usually requires changes in both `.teams` and `src/lib/agent/workbench-defaults.ts`.

## State And Storage

- Main app state is in `src/store/app.ts` using Zustand.
- `useApp()` is a compatibility export over the Zustand store.
- Persisted preferences use helpers in `src/lib/storage`.
- Storage keys are centralized in `src/config/constants.ts`.
- SQLite actions live in `src/lib/database`.
- Keep secrets out of tracked files. `.env.local` can provide local values such as `VITE_ELEVENLABS_API_KEY`.

Common persisted areas:

- provider selection and custom cURL providers
- audio input/output devices
- response settings
- shortcut settings
- app customization: transparency, always-on-top, content protection, cursor mode, dock/taskbar visibility
- context memory and meeting VAD settings
- speaker profiles and diarization
- IMA integration config
- hired agents and enabled skills

## Provider System

Provider configuration has two layers:

- Built-in provider registry: `src/lib/providers/registry.ts`
- Legacy/custom cURL provider storage: `src/lib/storage/ai-providers.ts` and `src/lib/storage/stt-providers.ts`

`src/lib/agent/runtime.ts` resolves an agent's provider connection, creates a direct runtime, loads enabled skills/MCP tools, injects memory, and streams events back to the UI.

When changing providers:

- Prefer registry entries for first-class providers.
- Preserve cURL custom provider compatibility unless deliberately migrating it.
- Check vision support and API wire format (`openai-completions` vs `anthropic-messages`).
- Use `tauriFetch` or Rust commands when browser CORS would block direct fetch.

## Agent Workbench

Important files:

- `src/pages/agents-chat/index.tsx` - standalone workbench shell
- `src/pages/agents-chat/chat.tsx` - channel chat UI and message handling
- `src/pages/agents-chat/agents.tsx` - agent catalog / hiring
- `src/pages/agents-chat/skills.tsx` - skill settings
- `src/hooks/useGroupChat.ts` - group chat state and persistence
- `src/lib/storage/group-chat.storage.ts` - channel storage
- `src/lib/data/agent-loader.ts` - agent catalog loading
- `src/lib/agent/tools/` - runtime tools exposed to agents
- `src/lib/agent/memory/` - memory snippet and memory tool support

Commands and skills are Markdown-first. Keep agent/team definitions readable because users and agents both consume them.

## Tauri Backend

Rust modules live under `src-tauri/src`:

- `lib.rs` - Tauri builder, plugin registration, app setup, shared commands
- `window.rs` - window visibility, movement, sizing, focus, dock/taskbar behavior
- `capture.rs` - screenshot and capture overlay support
- `shortcuts.rs` - global shortcut registration and shortcut actions
- `api.rs` - AI/STT related backend commands
- `speaker/` - speaker diarization and voice profile commands
- `health.rs` - health data commands
- `mcp/` - MCP session management
- `unified/` - unified process/session management
- `zero_token.rs` - browser-session provider support
- `fs_tools/`, `http_tools.rs`, `search_tools/`, `sandbox.rs` - agent tool backing commands
- `activate.rs` - activation/license related commands

Register new commands in `tauri::generate_handler!` inside `src-tauri/src/lib.rs`.

## UI And Style

- Use `@/` imports for source paths.
- Shared components belong in `src/components`; route-specific components belong under their page folder.
- UI primitives live in `src/components/ui`.
- Use Tailwind utility classes and the `cn()` helper from `src/lib/utils.ts`.
- Keep strings translated when they are part of navigation or settings UI.
- Keep dashboard/support copy aligned with current Niuma positioning: invisible private team, not legacy coupon/license marketing.

## Testing And Verification

Use the narrowest verification command that proves the change, then broaden when touching shared code.

- Type check: `npm run type-check`
- Lint: `npm run lint`
- Unit tests: `npm run test`
- Focused test example: `npx vitest run src/tests/editor-validation.test.ts`
- Frontend build: `npm run build`
- Desktop dev smoke test: `npm run tauri dev`

Existing tests live under `src/tests/` (for example `src/tests/editor-validation.test.ts` and `src/tests/lib/slash-commands/index.test.ts`). Do not colocate `*.test.ts` next to source.

## Common Tasks

### Add A New Team

1. Create `.teams/<id>/config.yaml`.
2. Add agent files under `.teams/<id>/agents/`.
3. Add commands under `.teams/<id>/commands/` if needed.
4. Add team skills under `.teams/<id>/skills/` or reference existing skill slugs.
5. Confirm `.teams/<id>/config.yaml` is picked up by workbench discovery.
6. Verify the workbench loads the team and starter prompts.

### Add A New Agent

1. Add the agent Markdown file under the relevant `.teams/<team>/agents/` folder.
2. Include clear role, responsibilities, and prompt instructions.
3. Add the filename to `agentFiles` in that team's `config.yaml`.

### Add A New Slash Command

1. Add a Markdown command file under `.teams/<team>/commands/`.
2. Keep the command name, usage, and output format explicit.
3. Ensure `commandDir` for the team points to the command folder.
4. Test from the agent workbench.

### Add A New Provider

1. Add first-class providers to `src/lib/providers/registry.ts`.
2. Add UI handling in `src/pages/providers/ai-configs/` only if the provider needs special configuration.
3. For STT, check `src/lib/functions/stt.function.ts` and `src/pages/speakers/`.
4. Verify with `npm run type-check`.

### Add A New Tauri Command

1. Implement the Rust command in the relevant `src-tauri/src/*.rs` module.
2. Register it in `tauri::generate_handler!`.
3. Call it from TypeScript with `invoke` from `@tauri-apps/api/core`.
4. Keep command names stable because the frontend calls them by string.

## Troubleshooting

- CORS errors: use `@tauri-apps/plugin-http` or a Rust command instead of browser `fetch`.
- Provider failures: check provider ID, API kind, base URL, model, and required variables.
- STT failures: check selected provider, API key, language, and audio permissions.
- Audio capture issues: check OS permissions and selected input/output devices.
- Shortcut issues: check `src-tauri/src/shortcuts.rs` and the saved shortcut config.
- Team missing in workbench: check `.teams/<id>/config.yaml`, `WORKBENCH_TEAM_PRESETS`, and bundle resources in `tauri.conf.json`.
- Build issues: run `npm run type-check` first, then `npm run build`; Tauri builds also need a working Rust toolchain.
