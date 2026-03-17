import BottomSheet from "@gorhom/bottom-sheet";
import { useMemo, useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLayoutStore } from "../store/layoutStore";
import NotesPanel from "./NotesPanel";
import ChatPanel from "./ChatPanel";

export default function ReaderSidePanel() {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["12%", "50%", "90%"], []);
  const { activePanel, openPanel, closePanel } = useLayoutStore();

  useEffect(() => {
    if (activePanel === "none") {
      sheetRef.current?.close();
    } else {
      sheetRef.current?.snapToIndex(1);
    }
  }, [activePanel]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      enablePanDownToClose
      snapPoints={snapPoints}
      onClose={closePanel}
    >
      <View style={styles.header}>
        <Pressable
          style={[styles.tab, activePanel === "notes" && styles.tabActive]}
          onPress={() => openPanel("notes")}
        >
          <Text style={[styles.tabText, activePanel === "notes" && styles.tabTextActive]}>笔记</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activePanel === "chat" && styles.tabActive]}
          onPress={() => openPanel("chat")}
        >
          <Text style={[styles.tabText, activePanel === "chat" && styles.tabTextActive]}>对话</Text>
        </Pressable>
      </View>
      <View style={styles.content}>
        {activePanel === "chat" ? <ChatPanel /> : <NotesPanel />}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  tabActive: {
    backgroundColor: "#2563eb",
  },
  tabText: {
    color: "#111827",
    fontSize: 14,
  },
  tabTextActive: {
    color: "#ffffff",
  },
  content: {
    flex: 1,
  },
});
