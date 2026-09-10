/* eslint-disable @typescript-eslint/array-type */
import type { CustomInstruction, CustomToolDefinition } from "@/core/types/app-state";

export const INSTRUCTION_TEMPLATES: Array<{
  title: string;
  content: string;
  priority: CustomInstruction["priority"];
}> = [
  {
    title: "APK Build Pipeline — Strict",
    priority: "high",
    content: `You are the APK build agent for Mobile Agent (com.tecnicalbot.mobileagent).

STRICT BUILD PIPELINE — always follow when the user asks to build / rebuild the APK or when you have changed native code, app.json, eas.json, or package version:

1) Bump version in app.json (version) and android.versionCode (increment by 1) + package.json version to stay in sync. Explain the new version to the user.
2) Run \`npx expo prebuild --clean --platform android\` to regenerate android/ folder. Never edit android/ manually without a prebuild.
3) Build with ONE of:
   - Local Gradle (no EAS): \`cd android && ./gradlew assembleRelease\` -> output app/build/outputs/apk/release/app-release.apk -> copy to build/mobile-agent-v<version>.apk
   - EAS Local: \`eas build --platform android --profile production --local --output build/mobile-agent-v<version>.apk\`
   - EAS Cloud: \`eas build --platform android --profile production --non-interactive\` then download.
4) Verify: \`ls -lh build/*.apk\` and \`aapt dump badging\` (if available). Report size, versionCode, versionName, and package.
5) Never leave a half-broken prebuild: if prebuild fails, restore from git and inform the user.
6) After every successful build, update the Preview tab artifact if a web previewable file changed, and tell the user the exact local file:// path + how to download/share the APK.

If no native change happened, prefer Gradle Assemble for speed; fallback to eas build --local if gradle wrapper is missing.`,
  },
  {
    title: "Preview-Driven Development",
    priority: "normal",
    content: `PREVIEW PROTOCOL

Whenever you write or edit any file under workspace that is web-previewable (HTML, TSX/JSX, CSS, SVG, markdown):
- Save it as a workspace artifact so it appears in the Preview tab (routes/src/app, components, public/index.html, etc.).
- Use relative imports, avoid localhost URLs — previews run from file:// via WebView.
- After a code change, tell the user: “Open Preview tab → category = web — pull to refresh if needed.”
- For multi-file apps: ensure entry point is index.html or app root previewable.
- If no previewable artifact exists yet, create a minimal public/index.html that boots the app and mention it in the Preview banner.`,
  },
  {
    title: "Clean Build Policy",
    priority: "normal",
    content: `CLEAN BUILD POLICY

- Before an APK rebuild, run \`rm -rf build/*.apk\` plus optionally \`rm -rf android/build android/app/build\` when Gradle caches look stale.
- Always keep eas.json production profile as \`{ "buildType": "apk", "autoIncrement": true, "distribution": "internal" }\`.
- Never commit android/ or build/ artifacts (they are gitignored) — except you MAY leave the built APK in build/ for the release upload script.
- If JDK or Android SDK is missing, install it (JDK 17 + Android cmdline-tools) and set ANDROID_HOME/JAVA_HOME before retrying the build; never silently skip the build step.
- Report build logs verbatim when a build fails; propose one fix at a time.`,
  },
  {
    title: "Tool & Skill Expansion Agent",
    priority: "low",
    content: `EXPAND-ON-DEMAND

When the user asks for new tools or skills:
- Prefer adding a Custom Tool (in Tools Studio) or a Skill (SKILL.md) over editing built-ins.
- For a new tool: store it in custom_tools_json with name, description, instructions, category, enabled=true, and show the user the command to run.
- For a new skill: create SKILL.md markdown under .skills/<name>/SKILL.md with frontmatter (name, description, autoMatch, matchKeywords) and instructions; keep it <200 lines.
- After creation, call refresh so the skill/tool appears instantly, and tell the user where to enable/disable it (Tools Studio / Skills).`,
  },
];

export const CUSTOM_TOOL_TEMPLATES: Array<
  Omit<CustomToolDefinition, "id" | "createdAt" | "updatedAt">
> = [
  {
    name: "Expo Prebuild Clean",
    description: "Regenerate android/ & ios/ folders from app.json",
    instructions:
      "Run `npx expo prebuild --clean --platform android`. Requires app.json + package name consistent. Use when native config changed.",
    category: "apk",
    enabled: true,
  },
  {
    name: "Gradle Assemble Release",
    description: "Build APK locally via Gradle (no EAS queue)",
    instructions:
      "Run `cd android && ./gradlew assembleRelease`. Output: android/app/build/outputs/apk/release/app-release.apk. Copy to build/mobile-agent-v{version}.apk",
    category: "apk",
    enabled: true,
  },
  {
    name: "EAS Local Build",
    description: "EAS production APK without cloud queue",
    instructions:
      "Run `eas build --platform android --profile production --local --output build/mobile-agent-v{version}.apk`. Requires eas-cli logged in (eas login) and JDK 17 + Android SDK.",
    category: "apk",
    enabled: true,
  },
  {
    name: "EAS Cloud Build",
    description: "Trigger EAS cloud APK and auto-increment version",
    instructions:
      "Run `eas build --platform android --profile production --non-interactive`. EAS autoIncrements versionCode. Download artifact when finished and move to build/.",
    category: "apk",
    enabled: true,
  },
  {
    name: "Bundle & Sign",
    description: "Expo bundle + Gradle bundle for store-ready artifacts",
    instructions:
      "Run `npx expo export` then `cd android && ./gradlew bundleRelease`. Use for AAB; for plain APK prefer assembleRelease.",
    category: "build",
    enabled: false,
  },
  {
    name: "Preview Publisher",
    description: "Ensure workspace web artifact is Preview-ready",
    instructions:
      "After any code change, write/verify a web entry (e.g. public/index.html or src/app root) and tell user to open Preview → Web. Keep WebView file:// compatible, no localhost calls.",
    category: "workspace",
    enabled: true,
  },
];

export const APK_SKILL_MARKDOWNS: Array<{
  id: string;
  title: string;
  markdown: string;
}> = [
  {
    id: "apk-builder",
    title: "APK Builder",
    markdown: `---
name: apk-builder
description: Hands-off APK builder for Mobile Agent. Prebuilds native folders and runs Gradle/EAS to produce a release APK.
autoMatch: false
matchKeywords: [apk, build, android, gradle, eas, prebuild]
---

# APK Builder

Use this skill when the user asks to build, rebuild, or ship an Android APK.

## Pipeline

1. **Versions** — bump \`app.json\` \`expo.version\` and \`expo.android.versionCode\` (+1) and \`package.json\` version.
2. **Prebuild** — \`npx expo prebuild --clean --platform android\`
3. **Build** — pick one:
   - \`cd android && ./gradlew assembleRelease\` → \`android/app/build/outputs/apk/release/app-release.apk\` → copy to \`build/mobile-agent-v<version>.apk\`
   - or \`eas build --platform android --profile production --local --output build/mobile-agent-v<version>.apk\`
4. **Verify** — \`ls -lh build/*.apk\` + show versionCode with \`aapt dump badging\` if available.
5. **Report** — give the user the exact file path, size, version, and sharing instructions (Preview / share sheet).

## Notes
- Keep eas.json production as \`{ "buildType": "apk", "autoIncrement": true }\`.
- Never commit android/ or build/ (gitignored) except the final APK artifact for release upload.
- On JDK/SDK missing, install JDK 17 + Android cmdline-tools and set ANDROID_HOME before retry.
`,
  },
  {
    id: "apk-release",
    title: "APK Release Publisher",
    markdown: `---
name: apk-release
description: Publish a built APK to GitHub Releases and bump changelog.
autoMatch: false
matchKeywords: [release, publish, github, gh]
---

# APK Release Publisher

After a successful APK build:

1. Ensure \`build/*.apk\` exists.
2. Create or update \`CHANGELOG.md\` entry.
3. Run:
   \`\`\`
   gh release create v<version> build/mobile-agent-v<version>.apk --title "v<version>" --notes "APK build for Mobile Agent"
   \`\`\`
   or if the release exists:
   \`\`\`
   gh release upload v<version> build/mobile-agent-v<version>.apk --clobber
   \`\`\`
4. Print the release URL and asset download URL.
`,
  },
  {
    id: "preview-publisher",
    title: "Preview Publisher",
    markdown: `---
name: preview-publisher
description: Ensure every AI-built artifact is previewable in the Preview tab.
autoMatch: true
matchKeywords: [preview, webview, html, jsx, tsx, artifact]
---

# Preview Publisher

Whenever you create or edit web-previewable files:
- Write them as workspace files so the Preview tab can auto-detect them.
- Keep an entry point at \`public/index.html\` or a root route.
- Use relative URLs; never hardcode localhost/127.0.0.1 — previews run via file:// in RN WebView.
- After changes, tell the user: "Open Preview tab → Web → pull to refresh."

Categories detected: web, image, markdown, code. Web gets a live WebView banner.
`,
  },
  {
    id: "tool-factory",
    title: "Tool Factory",
    markdown: `---
name: tool-factory
description: Create new Custom Tools and Skills on demand and register them in Tools Studio.
autoMatch: false
matchKeywords: [tool, skill, studio, custom]
---

# Tool Factory

When the user asks for a new tool/skill:
- Add a Custom Tool via \`custom_tools_json\` (name, description, instructions, category, enabled).
- Or add a Skill via a new \`.skills/<name>/SKILL.md\` with frontmatter (name, description, autoMatch, matchKeywords).
- Keep skills < 200 lines. Keep tool instructions as runnable command + when to use.
- After creation, hydrate so it appears in Tools Studio / Skills and confirm to the user.
`,
  },
];
