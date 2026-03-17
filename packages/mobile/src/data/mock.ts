export const mockNotes = [
  {
    id: "note-1",
    title: "第一条笔记",
    content: "这是一个笔记示例，用于验证列表渲染。",
    createdAt: Date.now() - 1000 * 60 * 60,
    updatedAt: Date.now() - 1000 * 60 * 30,
  },
  {
    id: "note-2",
    title: "第二条笔记",
    content: "后续替换为真实数据源。",
    createdAt: Date.now() - 1000 * 60 * 20,
    updatedAt: Date.now() - 1000 * 60 * 10,
  },
];

export const mockMessages = [
  {
    id: "msg-1",
    role: "assistant",
    content: "你好，我是 Sageread 助手。",
  },
  {
    id: "msg-2",
    role: "user",
    content: "帮我总结这段内容。",
  },
];
