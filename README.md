# Mobile Agent

Mobile Agent is an open-source AI agent built specifically for mobile devices that runs entirely on your phone.

## Demo

[![Mobile Agent demo](https://img.youtube.com/vi/_P_SQ0MW-aU/maxresdefault.jpg)](https://youtu.be/_P_SQ0MW-aU?si=klxA4b7RU3Y2j5iy)

## Features

- On-device models that can run completely offline
- Runs completely on-device
- No external server required
- MCP support
- Skills system
- Persistent memory
- Multi-modal support
- Direct access to phone's internal storage
- Android permission-based access
- **Preview tab** — live code & web preview for anything the AI builds (HTML, code, images, docs) with syntax highlighting and one-tap share/open

## Preview Tab

A dedicated **Preview** bottom-tab (also in the sidebar) shows every file the agent creates in the workspace:

- Auto-selects the newest build (`artifact`/`created`) and shows **Code** vs **Preview** toggle
- `Web` files (`index.html`, `.html`) render live in a `WebView` with file-URL base so relative CSS/JS assets load
- Code files get syntax-highlighted viewing (JS/TS, Python, CSS, JSON, Markdown, etc.) with copy/share
- Images render inline; other files offer open/share/delete actions
- Search & filter chips (`All` / `Code` / `Web` / `Images` / `Docs`) instantly narrow the file list
- Pull-to-refresh and automatic hydration when the agent writes new files

Open it from the bottom navigation (`Chat · Preview · Files`) or the sidebar → **Preview**.

## Instructions & Tools Studio

Two new hubs live in **Settings** (also in the sidebar drawer):

- **Instructions** (`/settings/instructions`) — user-written system prompts injected into every agent run. Create high/normal/low priority instructions, enable/disable per turn, and seed from templates: *APK Build Pipeline — Strict*, *Preview-Driven Development*, *Clean Build Policy*, *Tool & Skill Expansion Agent*. Enabled instructions are sorted `high → normal → low` and appended to `runtimeSystem` in `src/providers/app-state/agent-run.ts`.

- **Tools Studio** (`/settings/tools-studio`) — unified control plane for built-in workspace tools, the APK build pipeline, custom tools, and skill templates:
  - *Core Workspace Tools* toggles (`workspace*`, `folder*` via `ToolToggleList`)
  - *APK Build Tools* one-tap controllers (Expo Prebuild, Gradle Assemble, EAS Local/Cloud, Bundle & Sign, Clean) backed by `APK_BUILD_TOOL_CONTROLS` in `src/modules/config/built-in-tools.ts`
  - *Custom Tools* CRUD stored as `custom_tools_json` in `appSettings` (`customInstructions`/`customTools` parsed in `src/core/db/repositories/shared.ts`, default `[]` in `src/providers/app-state/constants.ts`)
  - *APK Skills* import (apk-builder, apk-release, preview-publisher, tool-factory) via `importSkillMarkdown` → they auto-match keywords at runtime

Both studios persist via `appSettings` (`custom_instructions_json`, `custom_tools_json` through `configRepository.setSetting`) and hydrate through `hydrate()` so the agent sees them immediately. Use the sidebar → **Instructions** / **Tools Studio** for one-tap access.

## Building the APK

The app is an Expo 57 project with EAS Build configured for APKs.

```bash
pnpm install
# Local Gradle build (requires Android SDK 34 + JDK 17)
bash ./scripts/build-apk.sh --local
# or
pnpm run build:apk:local   # EAS local
pnpm run build:apk:cloud   # EAS cloud

# Manual
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
#   copied to ./build/mobile-agent-v2.3.0.apk
```

Version bump: `app.json` / `package.json` → `2.3.0` (`versionCode` 4) for the Instructions & Tools Studio release (Preview was 2.2.0 / 3).

## Installation

The application is distributed through GitHub Releases.

1. Download the latest APK from the Releases page.
2. Install the APK on your Android device.
3. Grant the required permissions.
4. Start using Mobile Agent.

## Contributing

Contributions are welcome. Feel free to open an issue for bug reports, feature requests, or submit a pull request if you'd like to contribute.

## License

This project is licensed under the MIT License.
