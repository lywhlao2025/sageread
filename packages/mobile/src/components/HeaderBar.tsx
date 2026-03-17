import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLayoutStore } from "../store/layoutStore";

export default function HeaderBar() {
  const insets = useSafeAreaInsets();
  const { activePanel, togglePanel, closePanel } = useLayoutStore();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}
    >
      <Text style={styles.title}>Sageread</Text>
      <View style={styles.actions}>
        <Pressable
          style={[styles.button, activePanel === "notes" && styles.buttonActive]}
          onPress={() => togglePanel("notes")}
        >
          <Text style={[styles.buttonText, activePanel === "notes" && styles.buttonTextActive]}>笔记</Text>
        </Pressable>
        <Pressable
          style={[styles.button, activePanel === "chat" && styles.buttonActive]}
          onPress={() => togglePanel("chat")}
        >
          <Text style={[styles.buttonText, activePanel === "chat" && styles.buttonTextActive]}>对话</Text>
        </Pressable>
        {activePanel !== "none" && (
          <Pressable style={styles.buttonGhost} onPress={closePanel}>
            <Text style={styles.buttonText}>关闭</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  buttonActive: {
    backgroundColor: "#2563eb",
  },
  buttonText: {
    color: "#111827",
    fontSize: 14,
  },
  buttonTextActive: {
    color: "#ffffff",
  },
  buttonGhost: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
});
