#!/usr/bin/env bash
set -euo pipefail

# Mobile Agent — APK rebuild script
# Builds a release APK with the new Preview tab and all recent changes.
#
# Usage:
#   bash ./scripts/build-apk.sh            # local Gradle build (requires Android SDK)
#   bash ./scripts/build-apk.sh --cloud    # EAS cloud build
#   bash ./scripts/build-apk.sh --local-eas # EAS local build (requires eas-cli)
#
# Prerequisites (local):
#   - Node 20+, pnpm 10+, Java 17, Android SDK 34+
#   - Run `pnpm install` first

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-local}"

echo "▶ Mobile Agent v$(node -p "require('./package.json').version") — APK build"
echo "  Mode: $MODE"
echo ""

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo "✘ Missing: $1 — please install it first."
    exit 1
  fi
}

case "$MODE" in
  --cloud)
    check_cmd eas
    check_cmd pnpm
    echo "☁  Starting EAS cloud build (production / APK)…"
    eas build --platform android --profile production --auto-submit=false
    ;;

  --local-eas)
    check_cmd eas
    check_cmd pnpm
    mkdir -p ./build
    echo "🔧 Starting EAS local build…"
    eas build --platform android --profile production --local --output ./build/mobile-agent.apk
    echo ""
    echo "✅ APK written to ./build/mobile-agent.apk"
    ls -lh ./build/mobile-agent.apk || true
    ;;

  local|""|--local)
    check_cmd pnpm
    echo "📦 Installing dependencies…"
    pnpm install

    echo ""
    echo "🧹 Prebuilding native project…"
    # expo prebuild will generate android/ folder; --clean ensures latest config (plugins, versionCode, WebView)
    npx expo prebuild --platform android --clean

    echo ""
    echo "🔨 Building APK with Gradle (release)…"
    cd android
    # Use assembleRelease for APK; bundleRelease would produce AAB
    ./gradlew assembleRelease --warning-mode all

    APK_SRC="app/build/outputs/apk/release/app-release.apk"
    DEST="$ROOT_DIR/build/mobile-agent-v$(node -p "require('../package.json').version" 2>/dev/null || echo "2.2.0").apk"
    # Fallback if node path wrong when cd android
    if [ ! -f "$APK_SRC" ]; then
      echo "⚠ Expected APK not at $APK_SRC — searching…"
      find app/build/outputs -name "*.apk" | head
      exit 1
    fi
    mkdir -p "$(dirname "$DEST")"
    cp "$APK_SRC" "$DEST"
    echo ""
    echo "✅ APK built: $DEST"
    ls -lh "$DEST"
    echo ""
    echo "Install on device:"
    echo "  adb install -r \"$DEST\""
    ;;

  *)
    echo "Unknown mode: $MODE"
    echo "Usage: bash ./scripts/build-apk.sh [--local|--local-eas|--cloud]"
    exit 1
    ;;
esac
