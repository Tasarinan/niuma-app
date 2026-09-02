# Niuma

![Open Source](https://img.shields.io/badge/Open%20Source-❤️-blue)
![Tauri](https://img.shields.io/badge/Built%20with-Tauri-orange)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-blue)
![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)

[GitHub](https://github.com/Tasarinan/niuma-app) · [Website](https://niuma-app.com/) · [Releases](https://github.com/Tasarinan/niuma-app/releases/latest)

> **Your invisible team.** A private virtual crew that works for you — health, meetings, creation, and learning by default.

Niuma is a local-first desktop app (Tauri + React). You are not talking to a single chat box. You command a set of specialists who live in a transparent toolbar and a floating workbench, collaborate in channels, and finish jobs with commands and skills.

## Why “Niuma”

In Chinese workplaces, people often call themselves **牛马** (*niuma*) — a workhorse who does the grinding, thankless jobs.

**NIUMA-APP** flips that joke: you assemble a *niuma* team around your daily life. You give the orders. The virtual colleagues take meeting notes, read lab reports, draft copy, and drill vocabulary. The labor is theirs. The command is yours.

## Default teams

On first launch the app provisions four channels from `.niuma/teams/`. Each team has its own agents, slash commands, and skills. Extra team folders are discovered automatically.


| Team        | What you ask them to do                                            | Default roles                                                              |
| ----------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| **Health**  | Profiles, symptoms and metrics, report reading, periodic summaries | Guide, report analyst, nutritionist, mind–body advisor, general doctor     |
| **Meeting** | Agendas, live capture, minutes, action items                       | Facilitator, noter, summarizer, tracker, communicator                      |
| **Content** | Topics, copy, scripts, polish, WeChat article pipeline             | Aria / Iris / Tina / Sam / Rose, plus research–write–review–format–publish |
| **Study**   | Grammar, vocabulary, reading, sentence breakdown, writing          | Tutor, grammar coach, vocab coach, reader, writing coach                   |


Health output is record-keeping and document reading, not medical care. The study team currently focuses on English.

## Features 



### Invisible workbench

The main window is a transparent toolbar. You can pin it on top, hide the dock or taskbar icon, and turn on content protection so the overlay is harder to capture in screenshots or screen shares. Shortcuts bring up input, screenshots, voice, and a pomodoro timer without stealing the current window.

A separate **floating workbench** (`/agent-chat`) holds the team channels: conversation list on the left, chat in the middle. Content channels can switch to an article editor.

### Command by channel

Teams run as group channels. You send a message or a `/command`; the matching agents respond with their roles and skills. Agents can be hired from a catalog. Skills are Markdown `SKILL.md` files, loaded on demand with `load_skill`. MCP servers are supported.

To add a team, put `TEAM.md`, `agents/`, `commands/`, and `skills/` under `.niuma/teams/<slug>/`. The app picks them up and syncs them into the workbench.

### Meetings you can hear and keep

A meeting channel captures the microphone and system audio, then runs your configured STT. Speaker diarization is optional. When the session ends, Niuma can write a summary (topics, decisions, action items) into context memory. Commands: `/start`, `/capture`, `/points`, `/actions`, `/summarize`, `/followup`.

### Health records and report reading

The health channel uses `/profile`, `/record`, `/analyze`, `/report`, and `/search` for profiles, daily logs, image-based report reading, and periodic reports. Exam attachments can sync to an IMA knowledge base. Daily notes and interpretations stay in a local database.

### Creation and study

The content team covers ideation through a finished draft, including a WeChat article pipeline (topics, writing, review, layout, images, publish). The study team uses `gt-grammar`, `gt-vocab`, `gt-reading`, `gt-sentence`, and `gt-writing`, with `/ask`, `/quiz`, `/explain`, `/translate`, and `/review`.

### Toolbar

- **Screenshots** — full screen or region; attach manually, or auto-send with a preset prompt
- **Voice / STT** — microphone input, with pluggable speech-to-text providers
- **Attachments** — files sent with the message
- **Pomodoro** — countdown inside the toolbar; `Alt+1/2/3` switch focus and breaks, `Alt+Space` pause, `Alt+0` stop



### Runtime and settings

Agents call your configured LLM provider directly (built-in or custom curl). There is no Niuma proxy. Sandboxed tools include read/write/edit, list, grep, bash, and a human checkpoint.

Also in the dashboard: theme and locale, autostart, response length and language, shortcuts, context memory (team file memory plus meeting snapshots), cost tracking, and speaker / STT settings.

## Install

Binaries are on [GitHub Releases](https://github.com/Tasarinan/niuma-app/releases/latest): `.dmg` (macOS), `.msi` / `.exe` (Windows), `.deb` / `.rpm` / `.AppImage` (Linux).

System packages: [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/).

### From source

Node.js 18+ and a stable Rust toolchain.

```bash
git clone https://github.com/Tasarinan/niuma-app.git
cd niuma-app
npm install
npm run tauri dev
```

Production build:

```bash
npm run tauri build
```

Installers land in `src-tauri/target/release/bundle/`.

## Contributing

Bug fixes and improvements to existing behavior are welcome. New features, new LLM/STT providers, and large UI rewrites should start as an Issue.

1. Fork and branch
2. Change the code and add tests
3. Open a pull request



## License

GNU GPL v3.0 — see [LICENSE](LICENSE).

## Links

- Repo: [github.com/Tasarinan/niuma-app](https://github.com/Tasarinan/niuma-app)
- Site: [niuma-app.com](https://niuma-app.com/)
- Issues: [GitHub Issues](https://github.com/Tasarinan/niuma-app/issues)

