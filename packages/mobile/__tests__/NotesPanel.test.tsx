import { render } from "@testing-library/react-native";
import NotesPanel from "../src/components/NotesPanel";

jest.mock("../src/services/sharedServices", () => ({
  noteService: {
    getNotes: async () => [],
  },
}));

describe("NotesPanel", () => {
  it("renders empty state", async () => {
    const { findByText } = render(<NotesPanel />);
    expect(await findByText("暂无笔记")).toBeTruthy();
  });
});
