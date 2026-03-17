import { View, Text, StyleSheet, FlatList } from "react-native";
import { useEffect, useState } from "react";
import type { ThreadModel } from "../services/adapters";
import { getLatestThread } from "../services/threadClient";
import ErrorBanner from "./ErrorBanner";

export default function ChatPanel() {
  const [thread, setThread] = useState<ThreadModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getLatestThread()
      .then(setThread)
      .catch((err) => {
        setThread(null);
        setError(err instanceof Error ? err.message : "加载失败");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>对话</Text>
      <ErrorBanner message={error} />
      {loading ? (
        <Text style={styles.empty}>加载中...</Text>
      ) : thread?.messages?.length ? (
        <FlatList
          data={thread?.messages ?? []}
        keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}>
              <Text style={item.role === "user" ? styles.bubbleTextLight : styles.bubbleText}>{item.content}</Text>
            </View>
          )}
          contentContainerStyle={styles.list}
        />
      ) : (
        <Text style={styles.empty}>暂无对话</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  list: {
    gap: 12,
  },
  bubble: {
    padding: 12,
    borderRadius: 12,
    maxWidth: "85%",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#2563eb",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#f3f4f6",
  },
  bubbleText: {
    color: "#111827",
  },
  bubbleTextLight: {
    color: "#ffffff",
  },
  empty: {
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 16,
  },
});
