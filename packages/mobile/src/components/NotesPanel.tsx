import { View, Text, StyleSheet, FlatList } from "react-native";
import { useEffect, useState } from "react";
import type { NoteModel } from "../services/adapters";
import { toNoteModel } from "../services/adapters";
import { noteService } from "../services/sharedServices";
import ErrorBanner from "./ErrorBanner";

export default function NotesPanel() {
  const [notes, setNotes] = useState<NoteModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    noteService
      .getNotes()
      .then((data) => data.map(toNoteModel))
      .then(setNotes)
      .catch((err) => {
        setNotes([]);
        setError(err instanceof Error ? err.message : "加载失败");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>笔记</Text>
      <ErrorBanner message={error} />
      {loading ? (
        <Text style={styles.empty}>加载中...</Text>
      ) : notes.length === 0 ? (
        <Text style={styles.empty}>暂无笔记</Text>
      ) : (
        <FlatList
          data={notes}
        keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title || "未命名"}</Text>
              <Text style={styles.cardContent}>{item.content || ""}</Text>
            </View>
          )}
          contentContainerStyle={styles.list}
        />
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
  card: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardTitle: {
    fontWeight: "600",
    marginBottom: 4,
  },
  cardContent: {
    color: "#6b7280",
  },
  empty: {
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 16,
  },
});
