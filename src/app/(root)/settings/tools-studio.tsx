import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  ChevronLeft,
  Hammer,
  Package,
  Smartphone,
  Wrench,
  Plus,
  Trash2,
  Pencil,
  Download,
  Check,
  Box,
  Zap,
  Layers,
  GraduationCap,
} from "lucide-react-native";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Alert, Pressable, Text, TextInput, View, Switch, ScrollView } from "react-native";

import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToolToggleList } from "@/components/settings/tool-toggle-list";
import { Separator } from "@/components/ui/separator";
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useTheme } from "@/hooks/use-theme";
import { createRepositories } from "@/core/db/database";
import type { CustomToolDefinition } from "@/core/types/app-state";
import {
  APK_BUILD_TOOL_CONTROLS,
  BUILT_IN_FILE_TOOL_CONTROLS,
} from "@/modules/config/built-in-tools";
import {
  APK_SKILL_MARKDOWNS,
  CUSTOM_TOOL_TEMPLATES,
} from "@/modules/studio/templates";
import { useAppState } from "@/hooks/use-app-state";
import { useConfig } from "@/hooks/use-config";

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() {
  return new Date().toISOString();
}

export default function ToolsStudioScreen() {
  const router = useRouter();
  const theme = useTheme();
  const db = useSQLiteContext();
  const { refresh } = useAppState();
  const { importSkillMarkdown, skills } = useConfig();
  const repos = useMemo(() => createRepositories(db), [db]);

  const [customTools, setCustomTools] = useState<CustomToolDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CustomToolDefinition | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftInstructions, setDraftInstructions] = useState("");
  const [draftCategory, setDraftCategory] = useState<CustomToolDefinition["category"]>("custom");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | CustomToolDefinition["category"]>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await repos.configRepository.getSettings();
      setCustomTools(settings.customTools ?? []);
    } catch (e) {
      console.warn("load tools failed", e);
    } finally {
      setLoading(false);
    }
  }, [repos]);

  useEffect(() => {
    load();
  }, [load]);

  async function persist(next: CustomToolDefinition[]) {
    setSaving(true);
    try {
      await repos.configRepository.setSetting("custom_tools_json", JSON.stringify(next));
      setCustomTools(next);
      await refresh().catch(() => {});
      
    } catch (e) {
      Alert.alert("Save failed", String(e));
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setDraftName("");
    setDraftDesc("");
    setDraftInstructions("");
    setDraftCategory("custom");
    setDrawerOpen(true);
  }
  function openEdit(item: CustomToolDefinition) {
    setEditing(item);
    setDraftName(item.name);
    setDraftDesc(item.description);
    setDraftInstructions(item.instructions);
    setDraftCategory(item.category);
    setDrawerOpen(true);
  }
  async function handleSave() {
    if (!draftName.trim() || !draftInstructions.trim()) {
      Alert.alert("Missing fields", "Name and instructions are required.");
      return;
    }
    const next: CustomToolDefinition[] = editing
      ? customTools.map((t) =>
          t.id === editing.id
            ? {
                ...t,
                name: draftName.trim(),
                description: draftDesc.trim(),
                instructions: draftInstructions.trim(),
                category: draftCategory,
                updatedAt: nowIso(),
              }
            : t
        )
      : [
          {
            id: newId(),
            name: draftName.trim(),
            description: draftDesc.trim() || draftInstructions.trim().slice(0, 80),
            instructions: draftInstructions.trim(),
            category: draftCategory,
            enabled: true,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
          ...customTools,
        ];
    await persist(next);
    setDrawerOpen(false);
  }
  async function toggleEnabled(item: CustomToolDefinition) {
    const next = customTools.map((t) => (t.id === item.id ? { ...t, enabled: !t.enabled, updatedAt: nowIso() } : t));
    await persist(next);
    
  }
  async function remove(item: CustomToolDefinition) {
    Alert.alert("Delete tool?", `"${item.name}" will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const next = customTools.filter((t) => t.id !== item.id);
          await persist(next);
        },
      },
    ]);
  }
  async function addTemplate(tpl: (typeof CUSTOM_TOOL_TEMPLATES)[number]) {
    if (customTools.some((t) => t.name === tpl.name)) {
      Alert.alert("Already added", `"${tpl.name}" is already in your studio.`);
      return;
    }
    const next: CustomToolDefinition = {
      id: newId(),
      name: tpl.name,
      description: tpl.description,
      instructions: tpl.instructions,
      category: tpl.category,
      enabled: tpl.enabled,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await persist([next, ...customTools]);
  }
  async function handleImportSkill(md: (typeof APK_SKILL_MARKDOWNS)[number]) {
    const exists = skills.some((s) => s.title.toLowerCase() === md.title.toLowerCase() || s.title.toLowerCase().includes(md.id));
    if (exists) {
      Alert.alert("Skill exists", `"${md.title}" is already installed.`);
      return;
    }
    try {
      await importSkillMarkdown({ markdown: md.markdown });
      Alert.alert("Imported", `"${md.title}" skill installed and available in Skills.`);
      
    } catch (e) {
      Alert.alert("Import failed", String(e));
    }
  }

  const filteredTools = useMemo(() => {
    if (filter === "all") return customTools;
    return customTools.filter((t) => t.category === filter);
  }, [customTools, filter]);

  const enabledCustom = customTools.filter((t) => t.enabled).length;

  return (
    <Container scroll contentClassName="gap-sp-4 py-sp-4" includeBottomTabInset={false}>
      <View className="flex-row items-center gap-sp-2">
        <Button leftIcon={<ChevronLeft color={theme.text} size={16} />} onPress={() => router.push("/settings" as never)} size="icon-xs" variant="ghost" />
        <Text className="font-sans text-xl font-semibold text-foreground dark:text-foreground-dark">Tools Studio</Text>
        <Badge variant="secondary">
          <Text className="font-sans text-xs">{enabledCustom} enabled</Text>
        </Badge>
        <View className="flex-1" />
        <Button leftIcon={<Plus color={theme.background} size={16} />} onPress={openCreate} size="sm">
          New tool
        </Button>
      </View>

      <Text className="font-sans text-sm text-muted-foreground dark:text-muted-foreground-dark">
        Manage core tools, APK build pipeline tools, and your custom tools. All enabled tools are exposed to the agent; custom tools are injected as prompt instructions.
      </Text>

      {/* Core workspace tools */}
      <Card className="gap-sp-3 p-sp-4">
        <View className="flex-row items-center gap-sp-2">
          <Wrench color={theme.text} size={18} />
          <Text className="font-sans text-sm font-semibold text-foreground dark:text-foreground-dark">Core Workspace Tools</Text>
        </View>
        <Text className="font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark">
          File, folder, and workspace access. Disable to sandbox the agent.
        </Text>
        <ToolToggleList controls={BUILT_IN_FILE_TOOL_CONTROLS} />
      </Card>

      {/* APK Build Tools — predefined controls */}
      <Card className="gap-sp-3 p-sp-4">
        <View className="flex-row items-center gap-sp-2">
          <Smartphone color={theme.text} size={18} />
          <Text className="font-sans text-sm font-semibold text-foreground dark:text-foreground-dark">APK Build Tools</Text>
          <Badge variant="default">android</Badge>
        </View>
        <Text className="font-sans text-xs leading-4 text-muted-foreground dark:text-muted-foreground-dark">
          One-tap pipeline for <Text className="font-semibold">com.tecnicalbot.mobileagent</Text>. Add to Custom Tools to make them prompt-visible, or run the commands directly.
        </Text>

        <View className="gap-sp-2">
          {APK_BUILD_TOOL_CONTROLS.map((ctrl) => {
            const alreadyAdded = customTools.some((t) => t.name.toLowerCase().includes(ctrl.label.toLowerCase().slice(0, 10).toLowerCase()) || t.instructions.includes(ctrl.command.slice(0, 12)));
            return (
              <View
                key={ctrl.id}
                className="gap-sp-2 rounded-ui border border-border bg-background px-sp-3 py-sp-3 dark:border-border-dark dark:bg-background-dark"
              >
                <View className="flex-row items-start justify-between gap-sp-2">
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-center gap-sp-2">
                      <Text className="flex-1 font-sans text-sm font-medium text-foreground dark:text-foreground-dark">{ctrl.label}</Text>
                      <Badge variant="outline">{ctrl.category}</Badge>
                    </View>
                    <Text className="font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark">{ctrl.description}</Text>
                    <View className="rounded-sm bg-muted px-sp-2 py-sp-1 dark:bg-muted-dark">
                      <Text className="font-mono text-[11px] text-foreground dark:text-foreground-dark" selectable>
                        {ctrl.command}
                      </Text>
                    </View>
                  </View>
                </View>
                <View className="flex-row gap-sp-2">
                  <Button
                    size="sm"
                    variant={alreadyAdded ? "secondary" : "default"}
                    onPress={() => {
                      const tpl = CUSTOM_TOOL_TEMPLATES.find((t) => t.name.toLowerCase().includes(ctrl.label.split(" ")[0].toLowerCase()));
                      if (tpl) addTemplate(tpl);
                      else
                        addTemplate({
                          name: ctrl.label,
                          description: ctrl.description,
                          instructions: `Run \`${ctrl.command}\`. ${ctrl.description}`,
                          category: "apk",
                          enabled: true,
                        });
                    }}
                    leftIcon={alreadyAdded ? <Check color={theme.text} size={14} /> : <Plus color={theme.background} size={14} />}
                    className="flex-1"
                  >
                    {alreadyAdded ? "Added" : "Add to studio"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      Alert.alert(ctrl.label, `${ctrl.command}\n\nRun this in your terminal or ask the agent: "run ${ctrl.label}".`);
                    }}
                    className="flex-1"
                  >
                    Show command
                  </Button>
                </View>
              </View>
            );
          })}
        </View>

        <View className="rounded-ui bg-muted p-sp-3 dark:bg-muted-dark">
          <Text className="font-sans text-xs font-semibold text-foreground dark:text-foreground-dark">Quick build scripts</Text>
          <Text className="mt-1 font-mono text-[11px] leading-4 text-muted-foreground dark:text-muted-foreground-dark" selectable>
            pnpm build:apk:local{"\n"}pnpm build:apk:cloud{"\n"}./scripts/build-apk.sh --local
          </Text>
        </View>
      </Card>

      {/* APK Skills */}
      <Card className="gap-sp-3 p-sp-4">
        <View className="flex-row items-center gap-sp-2">
          <GraduationCap color={theme.text} size={18} />
          <Text className="font-sans text-sm font-semibold text-foreground dark:text-foreground-dark">APK Skills</Text>
          <Badge variant="secondary">{APK_SKILL_MARKDOWNS.length} templates</Badge>
        </View>
        <Text className="font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark">
          Import as Skills — they auto-match keywords and guide the agent through prebuild → gradle → release.
        </Text>
        <View className="gap-sp-2">
          {APK_SKILL_MARKDOWNS.map((sk) => {
            const installed = skills.some((s) => s.title.toLowerCase().includes(sk.title.toLowerCase().split(" ")[0].toLowerCase()));
            return (
              <View key={sk.id} className="flex-row items-center gap-sp-3 rounded-ui border border-border bg-background px-sp-3 py-sp-3 dark:border-border-dark dark:bg-background-dark">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <Box color={theme.text} size={16} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="font-sans text-sm font-medium text-foreground dark:text-foreground-dark">{sk.title}</Text>
                  <Text className="font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark" numberOfLines={2}>
                    {sk.markdown.split("\n").find((l) => l.trim() && !l.startsWith("---") && !l.startsWith("name:"))?.slice(0, 90)}
                  </Text>
                </View>
                <Button
                  size="sm"
                  variant={installed ? "secondary" : "default"}
                  onPress={() => handleImportSkill(sk)}
                  leftIcon={installed ? <Check color={theme.text} size={14} /> : <Download color={theme.background} size={14} />}
                >
                  {installed ? "Installed" : "Import"}
                </Button>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Custom Tools */}
      <Card className="gap-sp-3 p-sp-4">
        <View className="flex-row items-center gap-sp-2">
          <Hammer color={theme.text} size={18} />
          <Text className="font-sans text-sm font-semibold text-foreground dark:text-foreground-dark">Custom Tools</Text>
          <Badge variant="secondary">{customTools.length} total</Badge>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(["all", "apk", "build", "workspace", "general", "custom"] as const).map((c) => (
            <Pressable
              key={c}
              onPress={() => setFilter(c as any)}
              className={`rounded-full border px-sp-3 py-sp-1.5 ${filter === c ? "border-foreground bg-foreground dark:border-foreground-dark dark:bg-foreground-dark" : "border-border bg-background dark:border-border-dark dark:bg-background-dark"}`}
            >
              <Text className={`font-sans text-xs capitalize ${filter === c ? "text-background dark:text-background-dark" : "text-foreground dark:text-foreground-dark"}`}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Templates row */}
        <View className="gap-sp-2">
          <Text className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground-dark">Add from templates</Text>
          <View className="gap-sp-2">
            {CUSTOM_TOOL_TEMPLATES.filter((t) => filter === "all" || t.category === filter).map((tpl) => {
              const exists = customTools.some((ct) => ct.name === tpl.name);
              return (
                <Pressable
                  key={tpl.name}
                  onPress={() => addTemplate(tpl)}
                  className={`flex-row items-center gap-sp-3 rounded-ui border px-sp-3 py-sp-3 ${exists ? "border-border bg-muted/40 opacity-60" : "border-border bg-background dark:border-border-dark dark:bg-background-dark"}`}
                  style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
                >
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Zap color={theme.text} size={14} />
                  </View>
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-center gap-sp-2">
                      <Text className="font-sans text-sm font-medium text-foreground dark:text-foreground-dark">{tpl.name}</Text>
                      <Badge variant="outline">{tpl.category}</Badge>
                    </View>
                    <Text className="font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark" numberOfLines={1}>
                      {tpl.description}
                    </Text>
                  </View>
                  {exists ? <Check color={theme.textSecondary} size={16} /> : <Plus color={theme.text} size={16} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        <Separator />

        {loading ? (
          <Text className="font-sans text-sm text-muted-foreground dark:text-muted-foreground-dark">Loading…</Text>
        ) : filteredTools.length === 0 ? (
          <View className="items-center gap-sp-2 py-sp-4">
            <Layers color={theme.textSecondary} size={28} />
            <Text className="font-sans text-sm font-medium text-foreground dark:text-foreground-dark">No custom tools yet</Text>
            <Text className="text-center font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark">Create one or add from templates. Custom tools are injected into the prompt when enabled.</Text>
            <Button onPress={openCreate} size="sm" variant="outline" leftIcon={<Plus color={theme.text} size={14} />}>
              Create tool
            </Button>
          </View>
        ) : (
          <View className="gap-sp-3">
            {filteredTools.map((tool) => (
              <Card key={tool.id} className="gap-sp-2 p-sp-4">
                <View className="flex-row items-start justify-between gap-sp-2">
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-center gap-sp-2">
                      <Package color={theme.textSecondary} size={14} />
                      <Text className="flex-1 font-sans text-sm font-semibold text-foreground dark:text-foreground-dark" numberOfLines={1}>
                        {tool.name}
                      </Text>
                      <Badge variant="outline">{tool.category}</Badge>
                    </View>
                    <Text className="font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark" numberOfLines={2}>
                      {tool.description}
                    </Text>
                    <View className="rounded-sm bg-muted px-sp-2 py-sp-1 dark:bg-muted-dark">
                      <Text className="font-sans text-xs leading-4 text-foreground dark:text-foreground-dark" numberOfLines={2}>
                        {tool.instructions}
                      </Text>
                    </View>
                    <Text className="font-sans text-[10px] text-muted-foreground/70 dark:text-muted-foreground-dark/70">
                      {new Date(tool.updatedAt).toLocaleString()} · {tool.enabled ? "enabled" : "disabled"}
                    </Text>
                  </View>
                  <Switch value={tool.enabled} onValueChange={() => toggleEnabled(tool)} trackColor={{ true: theme.text }} />
                </View>
                <View className="flex-row gap-sp-2">
                  <Button onPress={() => openEdit(tool)} size="sm" variant="outline" leftIcon={<Pencil color={theme.text} size={14} />} className="flex-1">
                    Edit
                  </Button>
                  <Button onPress={() => remove(tool)} size="sm" variant="ghost" leftIcon={<Trash2 color={theme.destructive} size={14} />} className="flex-1">
                    Delete
                  </Button>
                </View>
              </Card>
            ))}
          </View>
        )}
      </Card>

      <Card className="gap-sp-1 p-sp-4">
        <Text className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground-dark">How custom tools work</Text>
        <Text className="font-sans text-xs leading-4 text-muted-foreground dark:text-muted-foreground-dark">
          Enabled custom tools are appended to the agent system prompt as “Studio Tools”. Create skills instead if you need keyword auto-matching — both live in the same prompt budget.
        </Text>
      </Card>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent showCloseButton>
          <DrawerHeader>
            <DrawerTitle>{editing ? "Edit tool" : "New custom tool"}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody contentContainerClassName="gap-sp-3">
            <View className="gap-sp-1">
              <Text className="font-sans text-xs font-semibold text-foreground dark:text-foreground-dark">Name</Text>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                placeholder="e.g. Gradle Assemble Release"
                placeholderTextColor={theme.textSecondary}
                className="rounded-ui border border-border bg-background px-sp-3 py-sp-3 font-sans text-sm dark:border-border-dark dark:bg-background-dark"
                style={{ color: theme.text }}
              />
            </View>
            <View className="gap-sp-1">
              <Text className="font-sans text-xs font-semibold text-foreground dark:text-foreground-dark">Description</Text>
              <TextInput
                value={draftDesc}
                onChangeText={setDraftDesc}
                placeholder="Short purpose shown in the list"
                placeholderTextColor={theme.textSecondary}
                className="rounded-ui border border-border bg-background px-sp-3 py-sp-3 font-sans text-sm dark:border-border-dark dark:bg-background-dark"
                style={{ color: theme.text }}
              />
            </View>
            <View className="gap-sp-1">
              <Text className="font-sans text-xs font-semibold text-foreground dark:text-foreground-dark">Category</Text>
              <View className="flex-row flex-wrap gap-sp-2">
                {(["apk", "build", "workspace", "general", "custom"] as const).map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setDraftCategory(c)}
                    className={`rounded-full border px-sp-3 py-sp-1.5 ${draftCategory === c ? "border-foreground bg-foreground dark:border-foreground-dark dark:bg-foreground-dark" : "border-border bg-background dark:border-border-dark dark:bg-background-dark"}`}
                  >
                    <Text className={`font-sans text-xs capitalize ${draftCategory === c ? "text-background dark:text-background-dark" : "text-foreground dark:text-foreground-dark"}`}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View className="gap-sp-1">
              <Text className="font-sans text-xs font-semibold text-foreground dark:text-foreground-dark">Instructions (injected into prompt when enabled)</Text>
              <TextInput
                value={draftInstructions}
                onChangeText={setDraftInstructions}
                placeholder="e.g. Run `cd android && ./gradlew assembleRelease` and copy APK to build/…"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                className="min-h-[140px] rounded-ui border border-border bg-background px-sp-3 py-sp-3 font-sans text-sm dark:border-border-dark dark:bg-background-dark"
                style={{ color: theme.text }}
              />
              <Text className="font-sans text-[11px] text-muted-foreground dark:text-muted-foreground-dark">{draftInstructions.length} chars</Text>
            </View>
          </DrawerBody>
          <DrawerFooter>
            <View className="flex-row gap-sp-2">
              <Button variant="outline" onPress={() => setDrawerOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onPress={handleSave} loading={saving} className="flex-1">
                {editing ? "Save" : "Create"}
              </Button>
            </View>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Container>
  );
}
