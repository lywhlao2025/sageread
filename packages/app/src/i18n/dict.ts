export type Locale = "zh" | "en";

export type I18nDict = Record<string, { zh: string; en: string }>;

export const I18N_DICT: I18nDict = {
  // App / Navigation
  "nav.library": { zh: "图书馆", en: "Library" },
  "nav.chat": { zh: "聊天", en: "Chat" },
  "nav.skills": { zh: "技能库", en: "Skills" },
  "nav.stats": { zh: "阅读统计", en: "Reading Stats" },
  "nav.settings": { zh: "设置", en: "Settings" },

  // Library
  "library.addBook": { zh: "添加书籍", en: "Add Book" },
  "library.importing": { zh: "上传中...", en: "Importing..." },
  "library.uncategorized": { zh: "未分类", en: "Uncategorized" },
  "library.myBooks": { zh: "我的图书", en: "My Library" },
  "library.dragDrop.title": { zh: "拖放文件以上传", en: "Drop files to upload" },
  "library.dragDrop.desc": { zh: "松开以上传您的书籍", en: "Release to upload your books" },
  "library.search.found": { zh: "找到 {count} 本书籍，搜索词：'{query}'", en: "Found {count} book(s) for '{query}'" },
  "library.search.empty": { zh: "没有找到 '{query}' 相关的书籍", en: "No books found for '{query}'" },
  "library.search.hint": { zh: "尝试使用不同的关键词搜索", en: "Try searching with different keywords" },

  // Chat
  "chat.noThreads.book": { zh: "还没有历史对话", en: "No chat history yet" },
  "chat.noThreads.global": { zh: "暂无聊天记录", en: "No chats yet" },
  "chat.noThreads.hint.book": { zh: "开始聊天来创建你的第一个对话", en: "Start chatting to create your first thread" },
  "chat.noThreads.hint.global": { zh: "开始对话来创建聊天记录", en: "Start a conversation to create chat history" },
  "chat.threads.title": { zh: "历史对话", en: "History" },
  "chat.loading": { zh: "加载中...", en: "Loading..." },
  "chat.loadFail": { zh: "加载历史对话失败", en: "Failed to load chat history" },
  "chat.retry": { zh: "重试", en: "Retry" },
  "chat.delete": { zh: "删除", en: "Delete" },
  "chat.deleteConfirm.title": { zh: "确认删除", en: "Confirm delete" },
  "chat.untitled": { zh: "未命名对话", en: "Untitled" },
  "chat.deleteConfirm.body": {
    zh: "确定要删除这个对话吗？\n\n\"{title}\"\n\n此操作无法撤销。",
    en: "Delete this conversation?\n\n\"{title}\"\n\nThis action cannot be undone.",
  },
  "chat.messageCount": { zh: "{count} 条消息", en: "{count} message(s)" },

  // Settings
  "settings.title": { zh: "设置", en: "Settings" },
  "settings.language": { zh: "语言", en: "Language" },
  "settings.language.system": { zh: "跟随系统", en: "System" },
  "settings.language.zh": { zh: "中文", en: "Chinese" },
  "settings.language.en": { zh: "英语", en: "English" },
  "settings.language.desc": { zh: "界面语言（默认跟随系统）", en: "UI language (defaults to system)" },

  "settings.about": { zh: "关于", en: "About" },
  "settings.appVersion": { zh: "应用版本", en: "App Version" },
  "settings.developer": { zh: "开发者", en: "Developer" },
  "settings.checkUpdate": { zh: "检查更新", en: "Check for Updates" },
  "settings.checkUpdate.desc": { zh: "检查是否有新版本可用", en: "Check whether a new version is available" },
  "settings.checkUpdate.downloading": { zh: "正在下载更新...", en: "Downloading update..." },
  "settings.checkUpdate.restart": { zh: "请重启应用以完成更新", en: "Restart the app to finish updating" },
  "settings.checking": { zh: "检查中...", en: "Checking..." },
  "settings.appearance": { zh: "外观", en: "Appearance" },
  "settings.themeMode": { zh: "明暗模式", en: "Theme" },
  "settings.themeMode.desc": { zh: "选择明暗模式偏好", en: "Choose your preferred theme" },
  "settings.theme.auto": { zh: "系统", en: "System" },
  "settings.theme.light": { zh: "亮色", en: "Light" },
  "settings.theme.dark": { zh: "暗色", en: "Dark" },
  "settings.autoScroll": { zh: "自动滚动", en: "Auto scroll" },
  "settings.autoScroll.desc": { zh: "聊天时自动滚动到最新消息", en: "Automatically scroll to the latest message" },
  "settings.swapSidebars": { zh: "对调侧边栏", en: "Swap sidebars" },
  "settings.swapSidebars.desc": { zh: "将聊天和笔记侧边栏位置对调", en: "Swap the positions of chat and notes sidebars" },
  "settings.dataFolder": { zh: "数据文件夹", en: "Data Folder" },
  "settings.appData": { zh: "应用数据", en: "App Data" },

  // Statistics
  "stats.title": { zh: "阅读统计", en: "Reading Stats" },
  "stats.subtitle": { zh: "查看您的阅读习惯和统计数据", en: "View your reading habits and statistics" },
  "stats.loadFailed": { zh: "加载失败", en: "Load failed" },
  "stats.loadFailedDetail": { zh: "加载统计数据失败", en: "Failed to load statistics" },
  "stats.totalSessions": { zh: "总阅读会话", en: "Total sessions" },
  "stats.totalSessions.desc": { zh: "累计阅读次数", en: "Cumulative sessions" },
  "stats.totalDuration": { zh: "总阅读时长", en: "Total duration" },
  "stats.totalDuration.desc": { zh: "累计阅读小时数", en: "Cumulative time" },
  "stats.activeDays": { zh: "活跃天数", en: "Active days" },
  "stats.activeDays.desc": { zh: "有阅读记录的天数", en: "Days with activity" },
  "stats.avgSessions": { zh: "平均每日会话", en: "Avg sessions/day" },
  "stats.avgSessions.desc": { zh: "活跃日平均会话数", en: "Average on active days" },
  "stats.heatmap": { zh: "阅读活动热力图", en: "Reading activity heatmap" },
  "stats.heatmap.desc": { zh: "过去一年的阅读活动分布，颜色深浅表示当天的阅读强度", en: "Reading activity over the past year; darker means more activity." },

  // Skills
  "skills.loadFail": { zh: "加载技能列表失败", en: "Failed to load skills" },
  "skills.title": { zh: "技能库", en: "Skills" },
  "skills.subtitle": { zh: "管理 AI 助手的技能和标准操作流程", en: "Manage skills and standard operating procedures for the AI assistant" },
  "skills.new": { zh: "新建技能", en: "New skill" },
  "skills.empty": { zh: "还没有任何技能", en: "No skills yet" },
  "skills.createFirst": { zh: "创建第一个技能", en: "Create your first skill" },

  // Toasts / Common
  "toast.selectNone": { zh: "未选择文件", en: "No file selected" },
  "toast.importFailed": { zh: "导入失败", en: "Import failed" },
  "toast.importSuccessCount": { zh: "成功导入 {count} 本书籍", en: "Imported {count} book(s)" },
  "toast.updateOk": { zh: "更新成功", en: "Updated" },
  "toast.updateFail": { zh: "更新失败", en: "Update failed" },
  "toast.checkUpdateFail": { zh: "检查更新失败", en: "Failed to check updates" },
  "toast.latest": { zh: "当前已是最新版本", en: "You're up to date" },
  "toast.foundNewVersion": { zh: "发现新版本 {version}", en: "New version {version} found" },
  "toast.updateDownloaded": { zh: "更新已下载", en: "Update downloaded" },

  // Common buttons
  "common.cancel": { zh: "取消", en: "Cancel" },
  "common.confirm": { zh: "确定", en: "Confirm" },

  // Reader selection actions
  "reader.explain": { zh: "请解释这段文字", en: "Please explain this text" },
  "reader.askMeaning": { zh: "这段内容有什么含义？", en: "What does this mean?" },
  "reader.action.copy": { zh: "复制", en: "Copy" },
  "reader.action.explain": { zh: "解释", en: "Explain" },
  "reader.action.translate": { zh: "翻译", en: "Translate" },
  "reader.action.askAI": { zh: "询问AI", en: "Ask AI" },
  "reader.action.highlight": { zh: "标注", en: "Highlight" },
  "reader.action.delete": { zh: "删除", en: "Delete" },
  "reader.action.note": { zh: "笔记", en: "Note" },
  "reader.note.quote": { zh: "引用", en: "Quote" },
  "reader.note.addition": { zh: "补充内容", en: "Your notes" },
  "reader.note.placeholder": { zh: "输入你的想法，可留空", en: "Write your thoughts (optional)" },
  "reader.askAI.placeholder": { zh: "询问AI任何问题", en: "Ask AI anything" },
  "reader.translateQuoted": { zh: "请将引用内容翻译成{lang}。", en: "Translate the quoted text into {lang}." },
  "reader.translateDirectives": {
    zh: "Answer the question directly.\nDo not include analysis, reasoning, thoughts, or explanations.\nOnly output the final result.",
    en: "Answer the question directly.\nDo not include analysis, reasoning, thoughts, or explanations.\nOnly output the final result.",
  },
  "reader.translateTextPrompt": {
    zh: "请将下面的内容翻译成{lang}，尽量逐句翻译，保留人名、地名和专有名词的原文，不要解释也不要总结，直接给出译文：\n\n{text}",
    en: "Translate the text below into {lang}. Prefer sentence-by-sentence translation. Preserve proper nouns (names, places, terms). Do not explain or summarize. Output only the translation:\n\n{text}",
  },

  // AI / Prompts
  "prompt.skills.header": { zh: "—— 可用技能库 ——", en: "—— Available Skills ——" },
  "prompt.skills.hint": {
    zh: "当前系统已配置以下技能，当用户需求匹配时，请先调用 getSkills 工具获取详细执行步骤：",
    en: "The system has the following skills configured. When the user's request matches, call the getSkills tool first to retrieve detailed steps:",
  },
  "prompt.context.semantic": { zh: "【语义上下文】", en: "[Semantic Context]" },
  "prompt.context.section": { zh: "【当前阅读章节】", en: "[Current Section]" },
  "prompt.context.meta": { zh: "【当前阅读图书元信息与目录】", en: "[Book Metadata & TOC]" },
};
