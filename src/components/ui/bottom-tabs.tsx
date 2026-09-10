import { usePathname, useRouter } from "expo-router";
import {
  Library as LibraryIcon,
  MessageSquare,
  Eye,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cn } from "@/core/utils";
import { useTheme } from "@/hooks/use-theme";

type TabConfig = {
  href: string;
  icon: typeof MessageSquare;
  label: string;
  match: (pathname: string) => boolean;
};

const TABS: TabConfig[] = [
  {
    href: "/",
    icon: MessageSquare,
    label: "Chat",
    match: (p) => p === "/" || p === "",
  },
  {
    href: "/preview",
    icon: Eye,
    label: "Preview",
    match: (p) => p === "/preview" || p.startsWith("/preview"),
  },
  {
    href: "/library",
    icon: LibraryIcon,
    label: "Files",
    match: (p) => p === "/library" || p.startsWith("/library"),
  },
];

export function BottomTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Hide on deep settings routes that have their own back navigation?
  // Keep visible on main routes only — but showing on settings too is not harmful.
  // We keep it visible everywhere except terminal full-screen.
  if (pathname === "/terminal") {
    return null;
  }

  // Don't show on settings sub-pages that expect full width? We'll still show but with muted.
  const isSettings = pathname.startsWith("/settings");
  if (isSettings) {
    return null;
  }

  return (
    <View
      className="border-t border-border bg-card dark:border-border-dark dark:bg-card-dark"
      style={{
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 6,
      }}
    >
      <View className="flex-row items-center justify-around px-sp-2">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Pressable
              key={tab.href}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (!active) {
                  router.push(tab.href as never);
                }
              }}
              className={cn(
                "flex-1 items-center justify-center gap-1 rounded-2xl px-sp-2 py-sp-2 mx-1",
                active ? "bg-foreground dark:bg-foreground-dark" : "bg-transparent"
              )}
              style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
            >
              <Icon
                color={active ? theme.background : theme.textSecondary}
                size={20}
                strokeWidth={active ? 2.5 : 2}
              />
              <Text
                className={cn(
                  "font-sans text-xs font-medium",
                  active
                    ? "text-background dark:text-background-dark"
                    : "text-muted-foreground dark:text-muted-foreground-dark"
                )}
              >
                {tab.label}
              </Text>
              {tab.href === "/preview" && active ? null : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Alternate inline segment switcher for use inside chat header if desired
export function ChatPreviewToggle({
  active,
  onChange,
}: {
  active: "chat" | "preview";
  onChange: (v: "chat" | "preview") => void;
}) {
  const theme = useTheme();
  return (
    <View className="flex-row rounded-full border border-border bg-card p-1 dark:border-border-dark dark:bg-card-dark">
      <Pressable
        onPress={() => onChange("chat")}
        className={cn(
          "flex-1 flex-row items-center justify-center gap-1 rounded-full px-sp-3 py-sp-2",
          active === "chat" ? "bg-foreground dark:bg-foreground-dark" : "bg-transparent"
        )}
      >
        <MessageSquare
          color={active === "chat" ? theme.background : theme.textSecondary}
          size={14}
        />
        <Text
          className={cn(
            "font-sans text-sm font-medium",
            active === "chat"
              ? "text-background dark:text-background-dark"
              : "text-muted-foreground dark:text-muted-foreground-dark"
          )}
        >
          Chat
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onChange("preview")}
        className={cn(
          "flex-1 flex-row items-center justify-center gap-1 rounded-full px-sp-3 py-sp-2",
          active === "preview" ? "bg-foreground dark:bg-foreground-dark" : "bg-transparent"
        )}
      >
        <Eye color={active === "preview" ? theme.background : theme.textSecondary} size={14} />
        <Text
          className={cn(
            "font-sans text-sm font-medium",
            active === "preview"
              ? "text-background dark:text-background-dark"
              : "text-muted-foreground dark:text-muted-foreground-dark"
          )}
        >
          Preview
        </Text>
      </Pressable>
    </View>
  );
}
