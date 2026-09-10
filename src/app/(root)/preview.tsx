import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import * as IntentLauncher from "expo-intent-launcher";
import * as LegacyFileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Code2,
  Copy,
  Eye,
  File as FileIcon,
  FileCode,
  FileText,
  Globe,
  Monitor,
  RefreshCw,
  Share2,
  Trash2,
  ExternalLink,
} from "lucide-react-native";

import { Container } from "@/components/shared/container";
import { SearchBox } from "@/components/shared/search-box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CodeViewer, detectLanguage } from "@/components/preview/code-viewer";
import {
  isTextWorkspaceFile,
  resolveWorkspaceFile,
} from "@/core/services/workspace-file-service";
import type { WorkspaceFile } from "@/core/types/app-state";
import { cn } from "@/core/utils";
import { useChat } from "@/hooks/use-chat";
import { useTheme } from "@/hooks/use-theme";

// Try to load WebView dynamically — fallback if not installed
let WebView: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebView = require("react-native-webview").WebView;
} catch {
  WebView = null;
}

type PreviewCategory = "all" | "code" | "web" | "images" | "docs";
type ViewerTab = "code" | "preview";

const CATEGORIES: { id: PreviewCategory; label: string; icon?: any }[] = [
  { id: "all", label: "All" },
  { id: "code", label: "Code" },
  { id: "web", label: "Web" },
  { id: "images", label: "Images" },
  { id: "docs", label: "Docs" },
];

function getFileCategory(file: WorkspaceFile): PreviewCategory[] {
  const cats: PreviewCategory[] = [];
  const name = file.displayName.toLowerCase();
  const mime = file.mimeType?.toLowerCase() ?? "";
  if (mime.startsWith("image/")) cats.push("images");
  if (isTextWorkspaceFile(file)) cats.push("docs");
  if (
    name.endsWith(".js") ||
    name.endsWith(".jsx") ||
    name.endsWith(".ts") ||
    name.endsWith(".tsx") ||
    name.endsWith(".py") ||
    name.endsWith(".json") ||
    name.endsWith(".css") ||
    name.endsWith(".yaml") ||
    name.endsWith(".yml") ||
    name.endsWith(".sh")
  )
    cats.push("code");
  if (name.endsWith(".html") || name.endsWith(".htm") || mime === "text/html") cats.push("web");
  return cats;
}

function inferCategory(file: WorkspaceFile, filter: PreviewCategory) {
  if (filter === "all") return true;
  return getFileCategory(file).includes(filter);
}

function isHtmlFile(file: WorkspaceFile) {
  const name = file.displayName.toLowerCase();
  return name.endsWith(".html") || name.endsWith(".htm") || file.mimeType === "text/html";
}

function isImageFile(file: WorkspaceFile) {
  return !!file.mimeType?.startsWith("image/");
}

function formatBytes(bytes: number | null) {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function PreviewScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    workspaceFiles,
    refreshWorkspaceFiles,
    deleteWorkspaceFile,
  } = useChat();

  const [category, setCategory] = useState<PreviewCategory>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewerTab, setViewerTab] = useState<ViewerTab>("code");
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Auto-select most recent file when nothing selected or file removed
  useEffect(() => {
    if (workspaceFiles.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId && workspaceFiles.some((f) => f.id === selectedId)) return;
    // pick most recent artifact/created first, else most recent overall
    const sorted = [...workspaceFiles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const preferred = sorted.find((f) => f.sourceKind === "artifact" || f.sourceKind === "created") ?? sorted[0];
    if (preferred) setSelectedId(preferred.id);
  }, [workspaceFiles, selectedId]);

  // Keep viewerTab in sync with file type
  const selectedFile = useMemo(
    () => workspaceFiles.find((f) => f.id === selectedId) ?? null,
    [workspaceFiles, selectedId]
  );

  useEffect(() => {
    if (selectedFile && isHtmlFile(selectedFile)) {
      setViewerTab("preview");
    } else if (selectedFile && isImageFile(selectedFile)) {
      setViewerTab("preview");
    } else {
      setViewerTab("code");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.id]);

  // Load file content when selection changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!selectedFile) {
        setFileContent(null);
        setContentError(null);
        return;
      }
      if (isImageFile(selectedFile)) {
        setFileContent(null);
        return;
      }
      if (!isTextWorkspaceFile(selectedFile) && !isHtmlFile(selectedFile)) {
        // binary preview unavailable
        setFileContent(null);
        setContentError(null);
        return;
      }
      setLoadingContent(true);
      setContentError(null);
      try {
        const file = resolveWorkspaceFile(selectedFile.relativePath);
        if (!file.exists) throw new Error("File not found on device");
        const text = await file.text();
        if (!cancelled) setFileContent(text);
      } catch (e) {
        if (!cancelled) setContentError(e instanceof Error ? e.message : "Failed to load file");
      } finally {
        if (!cancelled) setLoadingContent(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workspaceFiles.filter((f) => {
      if (!inferCategory(f, category)) return false;
      if (q) {
        return (
          f.displayName.toLowerCase().includes(q) ||
          (f.mimeType ?? "").toLowerCase().includes(q) ||
          f.relativePath.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [workspaceFiles, category, search]);

  const sortedFiltered = useMemo(
    () => [...filteredFiles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [filteredFiles]
  );

  // Find a web entry point (index.html or any html) for live preview banner
  const webEntry = useMemo(() => {
    const htmlFiles = workspaceFiles.filter(isHtmlFile);
    if (htmlFiles.length === 0) return null;
    const index = htmlFiles.find((f) => f.displayName.toLowerCase() === "index.html" || f.displayName.toLowerCase().includes("index"));
    return index ?? htmlFiles.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }, [workspaceFiles]);

  const handleRefresh = useCallback(async () => {
    try {
      await refreshWorkspaceFiles();
    } catch {}
  }, [refreshWorkspaceFiles]);

  const handleCopy = useCallback(async () => {
    if (!fileContent) return;
    await Clipboard.setStringAsync(fileContent);
    Alert.alert("Copied", "Code copied to clipboard");
  }, [fileContent]);

  const handleShare = useCallback(async (file: WorkspaceFile) => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Share unavailable", "Sharing is not available on this device.");
        return;
      }
      const localFile = resolveWorkspaceFile(file.relativePath);
      if (!localFile.exists) throw new Error("File not available");
      await Sharing.shareAsync(localFile.uri, {
        dialogTitle: `Share ${file.displayName}`,
        mimeType: file.mimeType ?? undefined,
      });
    } catch (e) {
      if (e instanceof Error && /cancel/i.test(e.message)) return;
      Alert.alert("Share failed", e instanceof Error ? e.message : "Failed to share");
    }
  }, []);

  const handleOpenExternal = useCallback(async (file: WorkspaceFile) => {
    try {
      const localFile = resolveWorkspaceFile(file.relativePath);
      if (!localFile.exists) throw new Error("File not available");
      const mimeType = isTextWorkspaceFile(file) ? "text/plain" : file.mimeType || "*/*";
      if (Platform.OS === "android") {
        const contentUri = await LegacyFileSystem.getContentUriAsync(localFile.uri);
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          flags: 1,
          type: mimeType,
        });
        return;
      }
      if (!(await Linking.canOpenURL(localFile.uri))) throw new Error("No app can open this file");
      await Linking.openURL(localFile.uri);
    } catch (e) {
      Alert.alert("Unable to open", e instanceof Error ? e.message : "Could not open file");
    }
  }, []);

  const handleDelete = useCallback(
    (file: WorkspaceFile) => {
      Alert.alert("Delete file?", `${file.displayName} will be permanently deleted.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setDeletingId(file.id);
            deleteWorkspaceFile(file.id)
              .catch((err) => Alert.alert("Delete failed", err instanceof Error ? err.message : "Failed"))
              .finally(() => setDeletingId(null));
          },
        },
      ]);
    },
    [deleteWorkspaceFile]
  );

  useEffect(() => {
    refreshWorkspaceFiles().catch(() => {});
  }, [refreshWorkspaceFiles]);

  const autoBuildHint = workspaceFiles.length > 0 && webEntry ? `Latest build: ${webEntry.displayName}` : null;

  return (
    <Container
      scroll
      contentClassName="gap-sp-4 py-sp-4"
      includeBottomTabInset
      contentStyle={{ paddingBottom: 16 }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between gap-sp-2">
        <View className="flex-row items-center gap-sp-2 flex-1">
          <Button
            leftIcon={<ChevronLeft color={theme.text} size={16} />}
            onPress={() => router.push("/")}
            size="icon-xs"
            variant="ghost"
          />
          <View className="flex-1">
            <Text className="font-sans text-xl font-semibold text-foreground dark:text-foreground-dark">
              Preview
            </Text>
            <Text className="font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark">
              {workspaceFiles.length === 0
                ? "No builds yet — ask the AI to create something"
                : `${workspaceFiles.length} files · AI builds appear live`}
            </Text>
          </View>
        </View>
        <Button
          variant="ghost"
          size="icon-xs"
          onPress={handleRefresh}
          accessibilityLabel="Refresh files"
        >
          <RefreshCw color={theme.textSecondary} size={18} />
        </Button>
      </View>

      {/* Live banner if web entry exists */}
      {webEntry && (
        <Pressable
          onPress={() => setSelectedId(webEntry.id)}
          className="flex-row items-center gap-sp-3 rounded-card border border-border bg-secondary px-sp-4 py-sp-3 dark:border-border-dark dark:bg-secondary-dark"
          style={({ pressed }) => (pressed ? { opacity: 0.9 } : null)}
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-background dark:bg-background-dark">
            <Globe color={theme.text} size={18} />
          </View>
          <View className="flex-1 gap-1">
            <Text className="font-sans text-sm font-semibold text-foreground dark:text-foreground-dark">
              Live preview ready
            </Text>
            <Text className="font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark" numberOfLines={1}>
              {autoBuildHint} · Tap to open
            </Text>
          </View>
          <Eye color={theme.textSecondary} size={16} />
        </Pressable>
      )}

      {/* Search */}
      <SearchBox value={search} onChangeText={setSearch} placeholder="Search files, e.g. index.html" />

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row" contentContainerStyle={{ gap: 8 }}>
        {CATEGORIES.map((cat) => {
          const active = category === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => setCategory(cat.id)}
              className={cn(
                "rounded-full border px-sp-3 py-sp-2",
                active
                  ? "border-foreground bg-foreground dark:border-foreground-dark dark:bg-foreground-dark"
                  : "border-border bg-card dark:border-border-dark dark:bg-card-dark"
              )}
            >
              <Text
                className={cn(
                  "font-sans text-sm font-medium",
                  active ? "text-background dark:text-background-dark" : "text-foreground dark:text-foreground-dark"
                )}
              >
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* File list */}
      {sortedFiltered.length > 0 ? (
        <Card className="overflow-hidden">
          {sortedFiltered.map((file, idx) => {
            const active = file.id === selectedId;
            const isHtml = isHtmlFile(file);
            const isImg = isImageFile(file);
            const cats = getFileCategory(file);
            return (
              <View key={file.id}>
                {idx > 0 ? <Separator /> : null}
                <Pressable
                  onPress={() => setSelectedId(file.id)}
                  className={cn(
                    "flex-row items-center gap-sp-3 px-sp-4 py-sp-3",
                    active && "bg-secondary dark:bg-secondary-dark"
                  )}
                  style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-card bg-secondary dark:bg-secondary-dark overflow-hidden">
                    {isImg ? (
                      <Image
                        source={{ uri: resolveWorkspaceFile(file.relativePath).uri }}
                        style={{ height: 40, width: 40 }}
                        contentFit="cover"
                      />
                    ) : isHtml ? (
                      <Globe color={theme.text} size={18} />
                    ) : cats.includes("code") ? (
                      <FileCode color={theme.text} size={18} />
                    ) : (
                      <FileText color={theme.text} size={18} />
                    )}
                  </View>
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="font-sans text-sm font-medium text-foreground dark:text-foreground-dark" numberOfLines={1}>
                      {file.displayName}
                    </Text>
                    <Text className="font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark" numberOfLines={1}>
                      {file.mimeType ?? "unknown"} · {formatBytes(file.size)} · {formatDate(file.updatedAt)}
                    </Text>
                    {file.relativePath.includes("/") ? (
                      <Text className="font-mono text-[11px] text-muted-foreground dark:text-muted-foreground-dark" numberOfLines={1}>
                        {file.relativePath}
                      </Text>
                    ) : null}
                  </View>
                  {active ? (
                    <View className="h-2 w-2 rounded-full bg-foreground dark:bg-foreground-dark" />
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </Card>
      ) : (
        <Card className="items-center gap-sp-3 px-sp-6 py-sp-8">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-secondary dark:bg-secondary-dark">
            <Code2 color={theme.textSecondary} size={24} />
          </View>
          <Text className="text-center font-sans text-base font-semibold text-foreground dark:text-foreground-dark">
            {workspaceFiles.length === 0 ? "No builds yet" : "No matches"}
          </Text>
          <Text className="text-center font-sans text-sm text-muted-foreground dark:text-muted-foreground-dark">
            {workspaceFiles.length === 0
              ? "Ask the AI to build a page, component, or app. Files it creates will appear here instantly with live preview."
              : `No files match “${search}” in ${category}. Try a different filter.`}
          </Text>
          {workspaceFiles.length === 0 ? (
            <Button onPress={() => router.push("/")} variant="outline" size="sm" className="mt-2">
              Go to Chat
            </Button>
          ) : null}
        </Card>
      )}

      {/* Selected file viewer */}
      {selectedFile ? (
        <Card className="overflow-hidden">
          {/* Viewer header */}
          <View className="gap-sp-3 px-sp-4 py-sp-3">
            <View className="flex-row items-start justify-between gap-sp-3">
              <View className="min-w-0 flex-1 gap-1">
                <Text className="font-sans text-base font-semibold text-foreground dark:text-foreground-dark" numberOfLines={1}>
                  {selectedFile.displayName}
                </Text>
                <Text className="font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark" numberOfLines={1}>
                  {selectedFile.relativePath} · {formatBytes(selectedFile.size)} · {selectedFile.sourceKind}
                </Text>
              </View>
              <View className="flex-row gap-1">
                <Pressable
                  onPress={handleCopy}
                  hitSlop={8}
                  className="h-9 w-9 items-center justify-center rounded-full bg-secondary dark:bg-secondary-dark"
                  style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
                >
                  <Copy color={theme.text} size={16} />
                </Pressable>
                <Pressable
                  onPress={() => handleShare(selectedFile)}
                  hitSlop={8}
                  className="h-9 w-9 items-center justify-center rounded-full bg-secondary dark:bg-secondary-dark"
                  style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
                >
                  <Share2 color={theme.text} size={16} />
                </Pressable>
                <Pressable
                  onPress={() => handleOpenExternal(selectedFile)}
                  hitSlop={8}
                  className="h-9 w-9 items-center justify-center rounded-full bg-secondary dark:bg-secondary-dark"
                  style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
                >
                  <ExternalLink color={theme.text} size={16} />
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(selectedFile)}
                  hitSlop={8}
                  disabled={!!deletingId}
                  className="h-9 w-9 items-center justify-center rounded-full bg-secondary dark:bg-secondary-dark"
                  style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
                >
                  <Trash2 color={theme.destructive} size={16} />
                </Pressable>
              </View>
            </View>

            {/* Tabs: Code | Preview */}
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setViewerTab("code")}
                className={cn(
                  "flex-1 flex-row items-center justify-center gap-1 rounded-full border px-sp-3 py-2",
                  viewerTab === "code"
                    ? "border-foreground bg-foreground dark:border-foreground-dark dark:bg-foreground-dark"
                    : "border-border bg-background dark:border-border-dark dark:bg-background-dark"
                )}
              >
                <Code2 color={viewerTab === "code" ? theme.background : theme.text} size={14} />
                <Text
                  className={cn(
                    "font-sans text-sm font-medium",
                    viewerTab === "code" ? "text-background dark:text-background-dark" : "text-foreground dark:text-foreground-dark"
                  )}
                >
                  Code
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setViewerTab("preview")}
                className={cn(
                  "flex-1 flex-row items-center justify-center gap-1 rounded-full border px-sp-3 py-2",
                  viewerTab === "preview"
                    ? "border-foreground bg-foreground dark:border-foreground-dark dark:bg-foreground-dark"
                    : "border-border bg-background dark:border-border-dark dark:bg-background-dark"
                )}
              >
                <Eye color={viewerTab === "preview" ? theme.background : theme.text} size={14} />
                <Text
                  className={cn(
                    "font-sans text-sm font-medium",
                    viewerTab === "preview" ? "text-background dark:text-background-dark" : "text-foreground dark:text-foreground-dark"
                  )}
                >
                  Preview
                </Text>
              </Pressable>
            </View>
          </View>

          <Separator />

          {/* Viewer content */}
          <View className="min-h-[320px] bg-background dark:bg-background-dark">
            {viewerTab === "code" ? (
              loadingContent ? (
                <View className="items-center justify-center py-sp-8">
                  <Text className="font-sans text-sm text-muted-foreground dark:text-muted-foreground-dark">Loading…</Text>
                </View>
              ) : contentError ? (
                <View className="px-sp-4 py-sp-4">
                  <Text className="font-sans text-sm text-destructive dark:text-destructive-dark">{contentError}</Text>
                </View>
              ) : isImageFile(selectedFile) ? (
                <View className="items-center justify-center p-sp-4">
                  <Image
                    source={{ uri: resolveWorkspaceFile(selectedFile.relativePath).uri }}
                    style={{ width: "100%", aspectRatio: 1, maxHeight: 420, borderRadius: 16 }}
                    contentFit="contain"
                  />
                </View>
              ) : fileContent !== null ? (
                <View className="gap-2">
                  <View className="flex-row items-center justify-between px-sp-4 pt-sp-2">
                    <Text className="font-mono text-xs text-muted-foreground dark:text-muted-foreground-dark">
                      {detectLanguage(selectedFile.displayName, selectedFile.mimeType) || "text"} · {fileContent.split("\n").length} lines
                    </Text>
                    <Pressable onPress={handleCopy} className="flex-row items-center gap-1">
                      <Copy color={theme.textSecondary} size={12} />
                      <Text className="font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark">Copy</Text>
                    </Pressable>
                  </View>
                  <View className="mx-sp-3 mb-sp-3 overflow-hidden rounded-card border border-border dark:border-border-dark">
                    <CodeViewer code={fileContent} fileName={selectedFile.displayName} mimeType={selectedFile.mimeType} />
                  </View>
                </View>
              ) : (
                <View className="items-center justify-center px-sp-4 py-sp-8 gap-2">
                  <FileIcon color={theme.textSecondary} size={24} />
                  <Text className="text-center font-sans text-sm text-muted-foreground dark:text-muted-foreground-dark">
                    Binary file — preview not available as text
                  </Text>
                  <Text className="text-center font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark">
                    {formatBytes(selectedFile.size)} · {selectedFile.mimeType ?? "unknown type"}
                  </Text>
                </View>
              )
            ) : (
              // Preview tab
              isImageFile(selectedFile) ? (
                <View className="items-center justify-center p-sp-4 bg-secondary dark:bg-secondary-dark">
                  <Image
                    source={{ uri: resolveWorkspaceFile(selectedFile.relativePath).uri }}
                    style={{ width: "100%", aspectRatio: 1, maxHeight: 520, borderRadius: 16 }}
                    contentFit="contain"
                  />
                </View>
              ) : isHtmlFile(selectedFile) ? (
                WebView ? (
                  <View style={{ height: 520, width: "100%", overflow: "hidden" }}>
                    <WebView
                      source={{ uri: resolveWorkspaceFile(selectedFile.relativePath).uri }}
                      style={{ flex: 1, backgroundColor: theme.background }}
                      originWhitelist={["*"]}
                      allowFileAccess
                      allowUniversalAccessFromFileURLs
                      allowFileAccessFromFileURLs
                      javaScriptEnabled
                      domStorageEnabled
                      mixedContentMode="always"
                      startInLoadingState
                    />
                  </View>
                ) : (
                  <View className="gap-3 px-sp-4 py-sp-6">
                    <View className="flex-row items-center gap-2">
                      <Monitor color={theme.textSecondary} size={18} />
                      <Text className="font-sans text-sm font-semibold text-foreground dark:text-foreground-dark">Web preview unavailable</Text>
                    </View>
                    <Text className="font-sans text-sm text-muted-foreground dark:text-muted-foreground-dark">
                      Install react-native-webview to enable live HTML preview. You can still view code in the Code tab or open the file externally.
                    </Text>
                    <Button variant="outline" size="sm" onPress={() => handleOpenExternal(selectedFile)} leftIcon={<ExternalLink color={theme.text} size={14} />}>
                      Open externally
                    </Button>
                    {fileContent ? (
                      <View className="mt-2 overflow-hidden rounded-card border border-border dark:border-border-dark">
                        <CodeViewer code={fileContent} fileName={selectedFile.displayName} mimeType={selectedFile.mimeType} />
                      </View>
                    ) : null}
                  </View>
                )
              ) : fileContent !== null && selectedFile.displayName.toLowerCase().endsWith(".md") ? (
                <ScrollView className="flex-1" contentContainerClassName="p-sp-4 gap-2">
                  <Text selectable className="font-sans text-sm leading-6 text-foreground dark:text-foreground-dark">
                    {fileContent}
                  </Text>
                  <Text className="font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark">Markdown preview (raw)</Text>
                </ScrollView>
              ) : fileContent !== null ? (
                <View className="gap-2">
                  <Text className="px-sp-4 pt-sp-3 font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark">
                    No visual preview for this file type — showing code instead
                  </Text>
                  <View className="mx-sp-3 mb-sp-3 overflow-hidden rounded-card border border-border dark:border-border-dark">
                    <CodeViewer code={fileContent} fileName={selectedFile.displayName} mimeType={selectedFile.mimeType} />
                  </View>
                </View>
              ) : (
                <View className="items-center justify-center py-sp-8 gap-2">
                  <Eye color={theme.textSecondary} size={24} />
                  <Text className="font-sans text-sm text-muted-foreground dark:text-muted-foreground-dark">No preview available</Text>
                </View>
              )
            )}
          </View>
        </Card>
      ) : null}

      <View className="gap-2 pt-sp-2">
        <Text className="font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark">
          Tip: Ask the AI to “build a landing page” or “create an HTML app” — it will appear here automatically for live preview. Tap any file to inspect code, copy, or open externally.
        </Text>
      </View>
    </Container>
  );
}
