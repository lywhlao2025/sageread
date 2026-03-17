import { render } from "@testing-library/react-native";
import ChatPanel from "../src/components/ChatPanel";

jest.mock("../src/services/threadClient", () => ({
  getLatestThread: async () => null,
}));

describe("ChatPanel", () => {
  it("renders empty state", async () => {
    const { findByText } = render(<ChatPanel />);
    expect(await findByText("暂无对话")).toBeTruthy();
  });
});
