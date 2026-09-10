import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { refractor } from "refractor";
import js from "refractor/javascript";
import jsx from "refractor/jsx";
import tsLang from "refractor/typescript";
import tsx from "refractor/tsx";
import css from "refractor/css";
import json from "refractor/json";
import markup from "refractor/markup";
import bash from "refractor/bash";
import yaml from "refractor/yaml";
import python from "refractor/python";
import markdown from "refractor/markdown";
import type { TextStyle } from "react-native";

import { useTheme } from "@/hooks/use-theme";

try {
  // register languages if not already
  if (!refractor.registered("javascript")) refractor.register(js);
  if (!refractor.registered("jsx")) refractor.register(jsx);
  if (!refractor.registered("typescript")) refractor.register(tsLang);
  if (!refractor.registered("tsx")) refractor.register(tsx);
  if (!refractor.registered("css")) refractor.register(css);
  if (!refractor.registered("json")) refractor.register(json);
  if (!refractor.registered("markup")) refractor.register(markup);
  if (!refractor.registered("bash")) refractor.register(bash);
  if (!refractor.registered("yaml")) refractor.register(yaml);
  if (!refractor.registered("python")) refractor.register(python);
  if (!refractor.registered("markdown")) refractor.register(markdown);
} catch {}

type SyntaxNode =
  | { type: "text"; value: string }
  | {
      children: SyntaxNode[];
      properties?: { className?: unknown };
      type: "element";
    };

type SyntaxTokenKind =
  | "comment"
  | "constant"
  | "number"
  | "string"
  | "operator"
  | "keyword"
  | "function"
  | "regex"
  | "default";

const SYNTAX_KIND_CLASSES: Record<SyntaxTokenKind, readonly string[]> = {
  comment: ["comment", "prolog", "doctype", "cdata"],
  constant: ["property", "tag", "constant", "symbol", "deleted"],
  number: ["boolean", "number"],
  string: ["selector", "attr-name", "string", "char", "builtin", "inserted"],
  operator: ["operator", "entity", "url", "variable"],
  keyword: ["atrule", "attr-value", "keyword", "control", "directive"],
  function: ["function", "class-name"],
  regex: ["regex", "important"],
  default: [],
};

function getSyntaxTokenKind(classNames: string[]): SyntaxTokenKind {
  for (const [kind, classes] of Object.entries(SYNTAX_KIND_CLASSES)) {
    if (kind !== "default" && classNames.some((name) => (classes as string[]).includes(name))) {
      return kind as SyntaxTokenKind;
    }
  }
  return "default";
}

function getSyntaxTokenStyle(
  kind: SyntaxTokenKind,
  textColor: string,
  theme: ReturnType<typeof useTheme>
): TextStyle {
  switch (kind) {
    case "comment":
      return { color: theme.syntaxComment, fontStyle: "italic" };
    case "constant":
      return { color: theme.syntaxConstant };
    case "number":
      return { color: theme.syntaxNumber };
    case "string":
      return { color: theme.syntaxString };
    case "operator":
      return { color: theme.syntaxOperator };
    case "keyword":
      return { color: theme.syntaxKeyword };
    case "function":
      return { color: theme.syntaxFunction };
    case "regex":
      return { color: theme.syntaxRegex };
    default:
      return { color: textColor };
  }
}

function flattenSyntaxNodes(
  nodes: SyntaxNode[],
  parentKind: SyntaxTokenKind,
  runs: { kind: SyntaxTokenKind; text: string }[]
): void {
  for (const node of nodes) {
    if (node.type === "text") {
      runs.push({ kind: parentKind, text: node.value });
      continue;
    }
    const classNames = Array.isArray(node.properties?.className)
      ? (node.properties?.className as unknown[]).filter((c): c is string => typeof c === "string")
      : [];
    flattenSyntaxNodes(node.children, getSyntaxTokenKind(classNames), runs);
  }
}

export function detectLanguage(fileName: string, mimeType?: string | null): string {
  const lower = fileName.toLowerCase();
  const mime = mimeType?.toLowerCase() ?? "";
  if (lower.endsWith(".html") || lower.endsWith(".htm") || mime === "text/html") return "markup";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".jsx")) return "jsx";
  if (lower.endsWith(".tsx")) return "tsx";
  if (lower.endsWith(".ts")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return "javascript";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".sh") || lower.endsWith(".bash")) return "bash";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (mime.startsWith("text/")) return "markup";
  return "";
}

export function CodeViewer({
  code,
  fileName,
  mimeType,
  maxLength = 8000,
}: {
  code: string;
  fileName: string;
  mimeType?: string | null;
  maxLength?: number;
}) {
  const theme = useTheme();
  const language = detectLanguage(fileName, mimeType);
  const displayCode = code.length > maxLength ? code.slice(0, maxLength) + "\n\n… truncated" : code;

  const highlighted = useMemo(() => {
    if (!language || !refractor.registered(language) || displayCode.length > 12000) return null;
    try {
      const nodes = refractor.highlight(displayCode, language).children as SyntaxNode[];
      return nodes;
    } catch {
      return null;
    }
  }, [displayCode, language]);

  if (!highlighted) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        style={{ maxWidth: "100%" }}
        nestedScrollEnabled
      >
        <Text
          selectable
          style={{
            color: theme.text,
            fontFamily: "monospace",
            fontSize: 13,
            lineHeight: 20,
            padding: 12,
          }}
        >
          {displayCode}
        </Text>
      </ScrollView>
    );
  }

  // flatten to runs
  const runs: { kind: SyntaxTokenKind; text: string }[] = [];
  flattenSyntaxNodes(highlighted, "default", runs);

  const styleCache = new Map<SyntaxTokenKind, TextStyle>();
  const getStyle = (kind: SyntaxTokenKind) => {
    let s = styleCache.get(kind);
    if (!s) {
      s = getSyntaxTokenStyle(kind, theme.text, theme);
      styleCache.set(kind, s);
    }
    return s;
  };

  // group consecutive same kind
  const grouped: { kind: SyntaxTokenKind; text: string }[] = [];
  for (const run of runs) {
    const last = grouped[grouped.length - 1];
    if (last && last.kind === run.kind) {
      last.text += run.text;
    } else {
      grouped.push({ ...run });
    }
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      style={{ maxWidth: "100%" }}
      nestedScrollEnabled
    >
      <Text
        selectable
        style={{
          fontFamily: "monospace",
          fontSize: 13,
          lineHeight: 20,
          padding: 12,
        }}
      >
        {grouped.map((g, i) => (
          <Text key={i} style={getStyle(g.kind)}>
            {g.text}
          </Text>
        ))}
      </Text>
    </ScrollView>
  );
}

export function InlineCodeMeta({
  language,
  lines,
  chars,
}: {
  language: string;
  lines: number;
  chars: number;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="rounded-full bg-secondary px-2 py-1 dark:bg-secondary-dark">
        <Text className="font-mono text-xs text-muted-foreground dark:text-muted-foreground-dark">
          {language || "text"}
        </Text>
      </View>
      <Text className="font-sans text-xs text-muted-foreground dark:text-muted-foreground-dark">
        {lines} lines · {chars} chars
      </Text>
    </View>
  );
}
