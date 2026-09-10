import { Slot } from "expo-router";
import { View } from "react-native";

import { AppSidebar } from "@/components/ui/app-sidebar";
import { BottomTabs } from "@/components/ui/bottom-tabs";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function Layout() {
  return (
    <SidebarProvider>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <AppSidebar />
          <Slot />
        </View>
        <BottomTabs />
      </View>
    </SidebarProvider>
  );
}
