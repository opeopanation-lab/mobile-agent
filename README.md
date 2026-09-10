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
#   copied to ./build/mobile-agent-v2.2.0.apk
```

Version bump: `app.json` / `package.json` → `2.2.0` (`versionCode` 3) for the Preview release.

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
