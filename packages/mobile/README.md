# sageread-mobile (RN)

Expo + React Native scaffold for Sageread mobile.

## Quick Start

```bash
pnpm i
pnpm start
```

## 环境变量

- `EXPO_PUBLIC_USE_MOCK=true` 使用 mock 数据
- `EXPO_PUBLIC_API_BASE_URL=https://api.readest.com`
- `EXPO_PUBLIC_API_TOKEN=...`

## 目录说明（当前目录下其他文件的作用说明）
- `App.tsx`：应用入口，挂载手势与安全区容器。
- `src/screens/ReaderScreen.tsx`：阅读主界面，组合 Header/阅读区/面板。
- `src/components/ReaderSidePanel.tsx`：BottomSheet 面板，切换笔记/对话。
- `src/components/ReaderViewer.tsx`：阅读区占位组件。
- `src/components/NotesPanel.tsx`：笔记面板占位组件。
- `src/components/ChatPanel.tsx`：对话面板占位组件。
- `src/components/HeaderBar.tsx`：顶部操作栏。
- `src/store/layoutStore.ts`：面板状态（notes/chat/none）。
- `assets/*`：应用图标/启动图占位。
