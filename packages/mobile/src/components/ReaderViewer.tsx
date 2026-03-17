import { View, Text, StyleSheet } from "react-native";

export default function ReaderViewer() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>阅读区（RN 版）</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    color: "#6b7280",
    fontSize: 16,
  },
});
