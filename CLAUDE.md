# CLAUDE.md - Niuma Project Guide

This file provides context for AI assistants (like Claude) when working on the Niuma codebase.

## Project Overview

**Niuma** is an open-source, privacy-first AI assistant desktop application built with Tauri. It works seamlessly during meetings, interviews, and conversations with features like speech-to-text, AI chat, screenshot analysis, and real-time translation.

Niuma is based on [Pluely](https://github.com/iamsrikanthnani/pluely) by [Srikanth Nani](https://www.srikanthnani.com/), providing your invisible AI wingman for every meeting.

- **Version**: 0.1.8
- **License**: GPL-3.0
- **Size**: ~10MB (27x smaller than commercial alternatives)
- **Platforms**: Windows, macOS, Linux

## Tech Stack

### Frontend
- **React 19.1.0** with TypeScript 5.8.3
- **Vite 7.0.4** for build tooling
- **Tailwind CSS 4.1.12** for styling
- **Radix UI** + **shadcn/ui** for components
- **React Router 7.9.5** for routing
- **Recharts** for charts

### Backend
- **Tauri 2** (Rust) for desktop integration
- **SQLite** via `@tauri-apps/plugin-sql`
- **HTTP client** via `@tauri-apps/plugin-http` (CORS bypass)

### Key Libraries
- `@ricky0123/vad-react` - Voice Activity Detection
- `@bany/curl-to-json` - CURL parsing for custom providers
- `shiki` - Syntax highlighting
- `react-markdown` + remark/rehype plugins - Markdown rendering

## Project Structure

```
Niuma/
├── src/                          # Frontend source code
�?  ├── main.tsx                  # App entry point
�?  ├── global.css                # Global Tailwind styles
�?  ├── components/               # Reusable components
�?  �?  ├── ui/                   # shadcn/ui components
�?  �?  ├── Markdown/             # Markdown renderer
�?  �?  ├── Header/               # Page header
�?  �?  └── ...
�?  ├── contexts/                 # React contexts
�?  �?  ├── app.context.tsx       # Main app state (providers, settings)
�?  �?  └── theme.context.tsx     # Theme management
�?  ├── hooks/                    # Custom React hooks
�?  �?  ├── useCompletion.ts      # Chat completion logic
�?  �?  ├── useSystemAudio.ts     # System audio capture
�?  �?  └── ...
�?  ├── pages/                    # Page components
�?  �?  ├── app/                  # Main overlay/chat interface
�?  �?  ├── dashboard/            # Dashboard
�?  �?  ├── chats/                # Chat history
�?  �?  ├── dev/                  # Developer tools (provider config)
�?  �?  ├── cost-tracking/        # API cost tracking
�?  �?  └── ...
�?  ├── lib/                      # Utilities and business logic
�?  �?  ├── database/             # SQLite operations
�?  �?  ├── functions/            # Core functions (AI, STT, etc.)
�?  �?  ├── storage/              # localStorage helpers
�?  �?  └── utils.ts              # Common utilities
�?  ├── types/                    # TypeScript type definitions
�?  ├── config/                   # Constants and configuration
�?  �?  ├── ai-providers.constants.ts
�?  �?  ├── stt.constants.ts
�?  �?  └── constants.ts
�?  ├── routes/                   # React Router configuration
�?  └── layouts/                  # Page layout wrappers
├── src-tauri/                    # Rust backend
�?  ├── src/                      # Rust source code
�?  ├── Cargo.toml                # Rust dependencies
�?  └── tauri.conf.json           # Tauri configuration
├── docs/                         # Documentation
├── package.json                  # NPM configuration
├── tsconfig.json                 # TypeScript configuration
└── vite.config.ts                # Vite configuration
```

## Key Patterns & Conventions

### State Management
1. **AppContext** (`contexts/app.context.tsx`) - Global app state
   - AI/STT provider selection
   - Settings and preferences
   - System prompts
2. **ThemeContext** - Theme and transparency
3. **Component-level hooks** - Local state (useCompletion, etc.)
4. **localStorage** - Persistent settings via `lib/storage/`
5. **SQLite** - Structured data (chats, usage, prompts)

### Provider System
Niuma uses a flexible provider system for AI and STT:
- Built-in providers defined in `config/ai-providers.constants.ts` and `config/stt.constants.ts`
- Custom providers via CURL templates
- Provider interface: `TYPE_PROVIDER` in `types/provider.type.ts`

```typescript
interface TYPE_PROVIDER {
  id: string;
  name: string;
  curl: string;              // CURL template with {{VARIABLES}}
  responseContentPath: string;
  isStreaming: boolean;
  isCustom?: boolean;
}
```

### Path Alias
Use `@/` for imports:
```typescript
import { Button } from "@/components";
import { useApp } from "@/contexts";
import { fetchSTT } from "@/lib";
```

### Component Organization
- **UI components**: `components/ui/` (shadcn/ui)
- **Feature components**: Within page directories (`pages/*/components/`)
- **Shared components**: `components/`

## Important Files

### Configuration
- `src/config/constants.ts` - Storage keys, defaults, feature flags
- `src/config/ai-providers.constants.ts` - Built-in AI providers (OpenAI, Claude, Groq, etc.)
- `src/config/stt.constants.ts` - Built-in STT providers (Whisper, Deepgram, etc.)

### Core Logic
- `src/lib/functions/ai-response.function.ts` - AI API calls
- `src/lib/functions/stt.function.ts` - Speech-to-text processing
- `src/lib/functions/translation.function.ts` - Translation service
- `src/lib/functions/Niuma.api.ts` - Niuma cloud API client

### Database
- `src/lib/database/chat-history.action.ts` - Conversation storage
- `src/lib/database/api-usage.action.ts` - Cost tracking
- `src/lib/database/meeting-context.action.ts` - Meeting memory

### Hooks
- `src/hooks/useCompletion.ts` - Main chat completion logic (extensive)
- `src/hooks/useSystemAudio.ts` - System audio capture
- `src/hooks/useGlobalShortcuts.ts` - Global keyboard shortcuts

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run Tauri development
npm run tauri dev

# Build Tauri application
npm run tauri build
```

Or use the batch files (Windows):
```bash
dev.bat          # Start development
build.bat        # Build application
stop.bat         # Stop dev server
```

## Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | App | Main overlay/chat interface |
| `/dashboard` | Dashboard | Overview and stats |
| `/chats` | Chats | Chat history |
| `/chats/view/:id` | Chat View | View specific conversation |
| `/system-prompts` | System Prompts | Manage prompts |
| `/shortcuts` | Shortcuts | Keyboard shortcuts |
| `/settings` | Settings | App settings |
| `/audio` | Audio | Audio device config |
| `/screenshot` | Screenshot | Screenshot settings |
| `/responses` | Responses | Response preferences |
| `/cost-tracking` | Cost Tracking | API usage costs |
| `/context-memory` | Context Memory | Knowledge base |
| `/dev-space` | Dev Space | Developer tools |

## Code Style

### TypeScript
- Strict mode enabled
- Prefer interfaces over types for objects
- Use `TYPE_` prefix for important type exports (e.g., `TYPE_PROVIDER`)

### React
- Functional components with hooks
- React 19 features available
- Use `ErrorBoundary` for error handling

### Naming Conventions
- **Files**: kebab-case (`ai-response.function.ts`)
- **Components**: PascalCase (`AutoSpeechVad.tsx`)
- **Hooks**: camelCase with `use` prefix (`useCompletion.ts`)
- **Constants**: SCREAMING_SNAKE_CASE (`STORAGE_KEYS`)
- **Types**: PascalCase, optionally with `TYPE_` prefix

### Styling
- Use Tailwind CSS utility classes
- Use `cn()` helper for conditional classes (from `lib/utils.ts`)
- Theme variables in `global.css`

## Common Tasks

### Adding a New AI Provider
1. Add CURL template to `config/ai-providers.constants.ts`
2. Provider will be automatically available in selection

### Adding a New STT Provider
1. Add CURL template to `config/stt.constants.ts`
2. Add pricing to `lib/storage/pricing.storage.ts` if needed
3. Provider will be automatically available

### Adding a New Page
1. Create directory in `pages/`
2. Add route in `routes/index.tsx`
3. Add menu item in `hooks/useMenuItems.tsx`

### Cost Tracking
- Use `window.dispatchEvent(new CustomEvent("usage-captured", { detail }))` for AI usage
- Use `window.dispatchEvent(new CustomEvent("stt-usage-captured", { detail }))` for STT usage
- Pricing defined in `lib/storage/pricing.storage.ts`

## Tauri Integration

### Invoke Commands
```typescript
import { invoke } from "@tauri-apps/api/core";
await invoke<ReturnType>("command_name", { arg1, arg2 });
```

### HTTP Requests (CORS bypass)
```typescript
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
const response = await tauriFetch(url, options);
```

### Key Plugins Used
- `plugin-sql` - SQLite database
- `plugin-http` - HTTP client
- `plugin-autostart` - Autostart on boot
- `plugin-global-shortcut` - Global keyboard shortcuts
- `plugin-updater` - Auto-updates

## Current Work in Progress

### Speaker Diarization (Planned)
See `docs/SPEAKER-DIARIZATION-PLAN.md` for implementation plan:
- AssemblyAI integration for speaker identification
- Voice enrollment system
- Cross-session speaker matching
- "Me vs Others" detection in meetings

### Translation Feature
See `docs/stt-translation-feature-plan.md` for translation implementation.

## Testing

Currently no automated tests. When adding tests:
- Use Vitest for unit tests
- Consider Playwright for E2E tests

## Troubleshooting

### Common Issues

**CORS errors**: Use `tauriFetch` instead of `fetch` for external APIs

**Provider not working**: Check CURL template variables match provider configuration

**Audio not capturing**: Check microphone permissions and device selection

**Build failures**: Ensure Rust toolchain is installed for Tauri

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the code style
4. Test thoroughly
5. Submit a pull request

## Resources

- [Tauri Documentation](https://tauri.app/v2/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [React 19 Documentation](https://react.dev/)

## Project History

Niuma is based on the excellent open-source foundation of [Pluely](https://github.com/iamsrikanthnani/pluely) by [Srikanth Nani](https://www.srikanthnani.com/). This fork maintains the GPL-3.0 license and builds upon the original work with a new brand identity focused on being "your invisible AI wingman."
