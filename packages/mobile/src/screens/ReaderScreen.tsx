import { View, StyleSheet } from "react-native";
import HeaderBar from "../components/HeaderBar";
import ReaderViewer from "../components/ReaderViewer";
import ReaderSidePanel from "../components/ReaderSidePanel";

export default function ReaderScreen() {
  return (
    <View style={styles.container}>
      <HeaderBar />
      <ReaderViewer />
      <ReaderSidePanel />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
});
