import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Pencil,
  Sparkles,
  Zap,
  ShieldAlert,
  Eye,
  Layers,
  Check,
} from "lucide-react-native";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Alert, Pressable, Switch, Text, TextInput, View } from "react-native";

import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useTheme } from "@/hooks/use-theme";
import { createRepositories } from "@/core/db/database";
import type { CustomInstruction } from "@/core/types/app-state";
import { INSTRUCTION_TEMPLATES } from "@/modules/studio/templates";
import { useAppState } from "@/hooks/use-app-state";

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() {
  return new Date().toISOString();
}

export default function InstructionsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const db = useSQLiteContext();
  const { refresh } = useAppState();
  const repos = useMemo(() => createRepositories(db), [db]);

  const [instructions, setInstructions] = useState<CustomInstruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CustomInstruction | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftPriority, setDraftPriority] = useState<CustomInstruction["priority"]>("normal");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await repos.configRepository.getSettings();
      setInstructions(settings.customInstructions ?? []);
    } catch (e) {
      console.warn("load instructions failed", e);
    } finally {
      setLoading(false);
    }
  }, [repos]);

  useEffect(() => {
    load();
  }, [load]);

  async function persist(next: CustomInstruction[]) {
    setSaving(true);
    try {
      await repos.configRepository.setSetting("custom_instructions_json", JSON.stringify(next));
      setInstructions(next);
      await refresh().catch(() => {});
      
    } catch (e) {
      Alert.alert("Save failed", String(e));
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setDraftTitle("");
    setDraftContent("");
    setDraftPriority("normal");
    setDrawerOpen(true);
  }

  function openEdit(item: CustomInstruction) {
    setEditing(item);
    setDraftTitle(item.title);
    setDraftContent(item.content);
    setDraftPriority(item.priority);
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!draftTitle.trim() || !draftContent.trim()) {
      Alert.alert("Missing fields", "Title and instructions are required.");
      return;
    }
    const next: CustomInstruction[] = editing
      ? instructions.map((i) =>
          i.id === editing.id ? { ...i, title: draftTitle.trim(), content: draftContent.trim(), priority: draftPriority, updatedAt: nowIso() } : i
        )
      : [
          {
            id: newId(),
            title: draftTitle.trim(),
            content: draftContent.trim(),
            enabled: true,
            priority: draftPriority,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
          ...instructions,
        ];
    await persist(next);
    setDrawerOpen(false);
  }

  async function toggleEnabled(item: CustomInstruction) {
    const next = instructions.map((i) => (i.id === item.id ? { ...i, enabled: !i.enabled, updatedAt: nowIso() } : i));
    await persist(next);
    
  }

  async function remove(item: CustomInstruction) {
    Alert.alert("Delete instruction?", `"${item.title}" will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const next = instructions.filter((i) => i.id !== item.id);
          await persist(next);
        },
      },
    ]);
  }

  async function addTemplate(tpl: (typeof INSTRUCTION_TEMPLATES)[number]) {
    if (instructions.some((i) => i.title === tpl.title)) {
      Alert.alert("Already added", `"${tpl.title}" is already in your instructions.`);
      return;
    }
    const next: CustomInstruction = {
      id: newId(),
      title: tpl.title,
      content: tpl.content,
      enabled: true,
      priority: tpl.priority,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await persist([next, ...instructions]);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return instructions;
    return instructions.filter(
      (i) => i.title.toLowerCase().includes(q) || i.content.toLowerCase().includes(q)
    );
  }, [instructions, search]);

  const enabledCount = instructions.filter((i) => i.enabled).length;

  return (
    <Container scroll contentClassName="gap-sp-4 py-sp-4" includeBottomTabInset={false}>
      <View className="flex-row items-center gap-sp-2">
        <Button leftIcon={<ChevronLeft color={theme.text} size={16} />} onPress={() => router.push("/settings" as never)} size="icon-xs" variant="ghost" />
        <Text className="font-sans text-xl font-semibold text-foreground dark:text-foreground-dark">Instructions</Text>
        {enabledCount > 0 ? <Badge variant="secondary">{enabledCount} active</Badge> : null}
        <View className="flex-1" />
        <Button leftIcon={<Plus color={theme.background} size={16} />} onPress={openCreate} size="sm">
          New
        </Button>
      </View>

      <Text className="font-sans text-sm text-muted-foreground dark:text-muted-foreground-dark">
        Instructions are injected into the agent&apos;s system prompt. Enabled instructions run every turn — use priority to steer importance.
      </Text>

      {/* Templates */}
      <Card className="gap-sp-3 p-sp-4">
        <View className="flex-row items-center gap-sp-2">
          <Sparkles color={theme.text} size={18} />
          <Text className="font-sans text-sm font-semibold text-foreground dark:text-foreground-dark">Templates</Text>
          <Text className="font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark">(tap to add)</Text>
        </View>
        <View className="gap-sp-2">
          {INSTRUCTION_TEMPLATES.map((tpl) => {
            const exists = instructions.some((i) => i.title === tpl.title);
            return (
              <Pressable
                key={tpl.title}
                onPress={() => addTemplate(tpl)}
                className={`rounded-ui border px-sp-3 py-sp-3 ${exists ? "border-border bg-muted/40 opacity-60 dark:border-border-dark" : "border-border bg-background dark:border-border-dark dark:bg-background-dark"}`}
                style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
              >
                <View className="flex-row items-center justify-between gap-sp-2">
                  <Text className="flex-1 font-sans text-sm font-medium text-foreground dark:text-foreground-dark" numberOfLines={1}>
                    {tpl.title}
                  </Text>
                  <Badge variant={tpl.priority === "high" ? "default" : tpl.priority === "low" ? "outline" : "secondary"}>{tpl.priority}</Badge>
                  {exists ? <Check color={theme.textSecondary} size={14} /> : <Plus color={theme.text} size={14} />}
                </View>
                <Text className="mt-1 font-sans text-xs leading-4 text-muted-foreground dark:text-muted-foreground-dark" numberOfLines={2}>
                  {tpl.content.slice(0, 140).replace(/\n/g, " ")}…
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Search */}
      <View className="flex-row items-center gap-sp-2 rounded-ui border border-border bg-background px-sp-3 py-sp-2 dark:border-border-dark dark:bg-background-dark">
        <Eye color={theme.textSecondary} size={16} />
        <TextInput
          placeholder="Search instructions…"
          placeholderTextColor={theme.textSecondary}
          value={search}
          onChangeText={setSearch}
          className="flex-1 font-sans text-sm text-foreground dark:text-foreground-dark"
          style={{ color: theme.text }}
        />
      </View>

      {/* List */}
      {loading ? (
        <Text className="font-sans text-sm text-muted-foreground dark:text-muted-foreground-dark">Loading…</Text>
      ) : filtered.length === 0 ? (
        <Card className="items-center gap-sp-2 p-sp-6">
          <Layers color={theme.textSecondary} size={28} />
          <Text className="font-sans text-sm font-medium text-foreground dark:text-foreground-dark">No instructions yet</Text>
          <Text className="text-center font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark">
            Tap “New” or add a template. Instructions with “high” priority are prepended to the agent prompt.
          </Text>
          <Button onPress={openCreate} size="sm" variant="outline" leftIcon={<Plus color={theme.text} size={14} />}>
            Create instruction
          </Button>
        </Card>
      ) : (
        <View className="gap-sp-3">
          {filtered.map((item) => (
            <Card key={item.id} className="gap-sp-2 p-sp-4">
              <View className="flex-row items-start justify-between gap-sp-2">
                <View className="flex-1 gap-1">
                  <View className="flex-row items-center gap-sp-2">
                    <Text className="flex-1 font-sans text-sm font-semibold text-foreground dark:text-foreground-dark" numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Badge variant={item.priority === "high" ? "default" : item.priority === "low" ? "outline" : "secondary"}>
                      {item.priority}
                    </Badge>
                    {item.priority === "high" ? <ShieldAlert color={theme.destructive} size={12} /> : item.priority === "low" ? <Zap color={theme.textSecondary} size={12} /> : null}
                  </View>
                  <Text className="font-sans text-xs leading-4 text-muted-foreground dark:text-muted-foreground-dark" numberOfLines={3}>
                    {item.content}
                  </Text>
                  <Text className="font-sans text-[10px] text-muted-foreground/70 dark:text-muted-foreground-dark/70">
                    {new Date(item.updatedAt).toLocaleString()} · {item.enabled ? "enabled" : "disabled"}
                  </Text>
                </View>
                <Switch value={item.enabled} onValueChange={() => toggleEnabled(item)} trackColor={{ true: theme.text }} />
              </View>
              <View className="flex-row gap-sp-2">
                <Button onPress={() => openEdit(item)} size="sm" variant="outline" leftIcon={<Pencil color={theme.text} size={14} />} className="flex-1">
                  Edit
                </Button>
                <Button onPress={() => remove(item)} size="sm" variant="ghost" leftIcon={<Trash2 color={theme.destructive} size={14} />} className="flex-1">
                  Delete
                </Button>
              </View>
            </Card>
          ))}
        </View>
      )}

      <Card className="gap-sp-1 p-sp-4">
        <Text className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground-dark">
          How it works
        </Text>
        <Text className="font-sans text-xs leading-4 text-muted-foreground dark:text-muted-foreground-dark">
          Enabled instructions (sorted high → normal → low) are injected after the base prompt and before skills/memory. Disable to pause without deleting. The agent sees them every run.
        </Text>
      </Card>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent showCloseButton>
          <DrawerHeader>
            <DrawerTitle>{editing ? "Edit instruction" : "New instruction"}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody contentContainerClassName="gap-sp-3">
            <View className="gap-sp-1">
              <Text className="font-sans text-xs font-semibold text-foreground dark:text-foreground-dark">Title</Text>
              <TextInput
                value={draftTitle}
                onChangeText={setDraftTitle}
                placeholder="e.g. APK Build Pipeline — Strict"
                placeholderTextColor={theme.textSecondary}
                className="rounded-ui border border-border bg-background px-sp-3 py-sp-3 font-sans text-sm dark:border-border-dark dark:bg-background-dark"
                style={{ color: theme.text }}
              />
            </View>
            <View className="flex-row gap-sp-2">
              {(["high", "normal", "low"] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setDraftPriority(p)}
                  className={`flex-1 items-center rounded-ui border px-sp-2 py-sp-2 ${draftPriority === p ? "border-foreground bg-secondary dark:border-foreground-dark dark:bg-secondary-dark" : "border-border bg-background dark:border-border-dark dark:bg-background-dark"}`}
                >
                  <Text className="font-sans text-xs font-semibold capitalize text-foreground dark:text-foreground-dark">{p}</Text>
                </Pressable>
              ))}
            </View>
            <View className="gap-sp-1">
              <Text className="font-sans text-xs font-semibold text-foreground dark:text-foreground-dark">Instructions (injected into system prompt)</Text>
              <TextInput
                value={draftContent}
                onChangeText={setDraftContent}
                placeholder="Tell the agent exactly what to do…"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                className="min-h-[180px] rounded-ui border border-border bg-background px-sp-3 py-sp-3 font-sans text-sm dark:border-border-dark dark:bg-background-dark"
                style={{ color: theme.text }}
              />
              <Text className="font-sans text-[11px] text-muted-foreground dark:text-muted-foreground-dark">{draftContent.length} chars</Text>
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
