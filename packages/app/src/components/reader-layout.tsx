import HomeLayout from "@/components/home-layout";
import LanguageSwitcher from "@/components/language-switcher";
import { NotepadContainer } from "@/components/notepad";
import NotificationDropdown from "@/components/notification-dropdown";
import SettingsDialog from "@/components/settings/settings-dialog";
import SideChat from "@/components/side-chat";
import WindowControls from "@/components/window-controls";
import { useFontEvents } from "@/hooks/use-font-events";
import ReaderViewer from "@/pages/reader";
import { ReaderProvider } from "@/pages/reader/components/reader-provider";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useLayoutStore } from "@/store/layout-store";
import { useModeStore } from "@/store/mode-store";
import { useThemeStore } from "@/store/theme-store";
import { getOSPlatform } from "@/utils/misc";
import { useT } from "@/hooks/use-i18n";
import ModeSelectionDialog from "@/components/mode-selection-dialog";
import { Tabs } from "app-tabs";
import { ArrowLeftRight, HomeIcon } from "lucide-react";
import { Resizable } from "re-resizable";
import { useEffect, useRef, useState } from "react";
import { Menu } from "@tauri-apps/api/menu";
import { LogicalPosition } from "@tauri-apps/api/window";
import { trackEvent } from "@/services/analytics-service";

export default function ReaderLayout() {
  useFontEvents(); // 监听系统字体变更事件，确保自定义字体加载后立即生效
  const {
    tabs, // 当前打开的标签列表
    activeTabId, // 当前激活的标签 ID
    isHomeActive, // 是否处于首页视图

    removeTab, // 关闭标签的动作
    closeOtherTabs,
    closeLeftTabs,
    closeRightTabs,
    activateTab, // 激活标签的动作
    navigateToHome, // 返回首页的动作
    getReaderStore, // 获取指定标签对应的 ReaderStore
    isChatVisible, // 聊天侧栏是否显示
    isNotepadVisible, // 笔记侧栏是否显示
  } = useLayoutStore(); // 读取布局相关状态
  const { isDarkMode, swapSidebars } = useThemeStore(); // 读取主题与侧栏位置交换配置
  const { isSettingsDialogOpen, toggleSettingsDialog } = useAppSettingsStore(); // 设置弹窗开关状态
  const { mode, setMode } = useModeStore();
  const t = useT();

  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 记录窗口大小调整的定时器句柄
  const [showOverlay, setShowOverlay] = useState(false); // 控制调整大小时的遮罩显示

  const isWindows = getOSPlatform() === "windows"; // 判断是否为 Windows，用于 Tabs 左侧留白
  const isSimpleMode = mode === "simple";
  const resolvedSwapSidebars = isSimpleMode ? false : swapSidebars;
  const showNotepadSidebar = isNotepadVisible;
  const handleToggleMode = () => {
    const nextMode = isSimpleMode ? "classic" : "simple";
    setMode(nextMode);
    trackEvent("switch_mode", { from: isSimpleMode ? "simple" : "classic", to: nextMode, source: "topbar" });
  };

  const handleTabContextMenu = async (tabId: string, event: MouseEvent) => {
    event.preventDefault();
    const tabIndex = tabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex === -1) return;
    activateTab(tabId);

    try {
      const menu = await Menu.new({
        items: [
          {
            id: "close-others",
            text: t("tabs.closeOthers", "关闭其他"),
            action: () => closeOtherTabs(tabId),
          },
          {
            id: "close-left",
            text: t("tabs.closeLeft", "关闭左侧"),
            action: () => closeLeftTabs(tabId),
          },
          {
            id: "close-right",
            text: t("tabs.closeRight", "关闭右侧"),
            action: () => closeRightTabs(tabId),
          },
        ],
      });

      await menu.popup(new LogicalPosition(event.clientX, event.clientY));
    } catch (error) {
      console.error("Failed to show tab context menu:", error);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setShowOverlay(true); // 窗口正在调整时显示遮罩，避免渲染抖动

      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current); // 清除上一次的延迟关闭遮罩
      }

      resizeTimeoutRef.current = setTimeout(() => {
        setShowOverlay(false); // 延迟隐藏遮罩，等待尺寸稳定
      }, 200);
    };

    window.addEventListener("resize", handleResize); // 监听窗口尺寸变化

    return () => {
      window.removeEventListener("resize", handleResize); // 卸载时移除监听
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current); // 清理未完成的定时器
      }
    };
  }, []); // 只在挂载/卸载时执行

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCloseShortcut =
        (event.metaKey && event.key === "w" && event.code === "KeyW") || // macOS 快捷关闭标签
        (event.ctrlKey && event.key === "w" && event.code === "KeyW"); // Windows/Linux 快捷关闭标签

      if (isCloseShortcut) {
        event.preventDefault(); // 阻止浏览器默认关闭行为
        if (activeTabId && activeTabId !== "home") {
          removeTab(activeTabId); // 关闭当前激活的阅读标签
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown); // 绑定键盘事件
    return () => {
      document.removeEventListener("keydown", handleKeyDown); // 卸载时移除
    };
  }, [activeTabId, removeTab]); // 激活的标签或关闭动作变化时重新绑定

  return (
    <div className="flex h-screen flex-col bg-muted"> {/* 整体容器，垂直排列充满屏幕 */}
      <div className="select-none border-neutral-200 dark:border-neutral-700 dark:bg-tab-background"> {/* 顶部标签栏容器 */}
        <Tabs
          tabs={tabs} // 提供标签数据
          onTabActive={activateTab} // 切换标签时触发
          onTabClose={removeTab} // 关闭标签时触发
          onTabReorder={() => {}} // 拖拽排序暂未实现
          onContextMenu={handleTabContextMenu}
          draggable={true} // 启用拖拽
          darkMode={isDarkMode} // 依据主题切换样式
          className="h-7" // 固定高度
          enableDragRegion={true} // 允许拖拽移动窗体
          marginLeft={isWindows ? 0 : 60} // macOS 需空出系统按钮区域
          pinnedLeft={
            <div className="mx-2 flex items-center gap-2" onClick={navigateToHome}> {/* 固定左侧的首页按钮 */}
              <HomeIcon className="size-5 text-neutral-700 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200" />
            </div>
          }
          pinnedRight={
            <div className="flex items-center gap-1"> {/* 固定右侧的通知和窗口控制 */}
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-600 transition hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
                onClick={handleToggleMode}
                title={t("mode.toggle", "切换模式")}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <LanguageSwitcher />
              <NotificationDropdown />
              <WindowControls />
            </div>
          }
        />
      </div>

      <main className="relative flex-1 overflow-hidden rounded-md"> {/* 主体区域，包含首页和阅读标签内容 */}
        <div
          className="absolute inset-0" // 覆盖主区域
          style={{
            visibility: isHomeActive ? "visible" : "hidden", // 仅在首页状态可见
            zIndex: isHomeActive ? 1 : 0, // 首页在最上层
          }}
        >
          <HomeLayout /> {/* 首页布局 */}
        </div>

        {tabs.map((tab) => { // 遍历所有标签渲染各自内容
          const store = getReaderStore(tab.id); // 获取该标签对应的 ReaderStore
          if (!store) return null; // 无 store 时跳过

          const notepadSidebar = showNotepadSidebar && ( // 笔记侧栏条件渲染
            <Resizable
              defaultSize={{
                width: 300, // 默认宽度
                height: "100%", // 占满高度
              }}
              minWidth={260} // 最小宽度
              maxWidth={500} // 最大宽度
              enable={{
                top: false,
                right: !resolvedSwapSidebars, // 根据配置决定拖拽手柄位置
                bottom: false,
                left: resolvedSwapSidebars,
                topRight: false,
                bottomRight: false,
                bottomLeft: false,
                topLeft: false,
              }}
              handleComponent={
                resolvedSwapSidebars
                  ? { left: <div className="custom-resize-handle" /> } // 侧栏在右时把手在左
                  : { right: <div className="custom-resize-handle custom-resize-handle-left" /> } // 侧栏在左时把手在右
              }
              className="h-full"
              onResize={() => {
                if (!showOverlay) {
                  setShowOverlay(true); // 拖拽中显示遮罩
                }
              }}
              onResizeStop={() => {
                setShowOverlay(false); // 停止拖拽隐藏遮罩
                window.dispatchEvent(
                  new CustomEvent("foliate-resize-update", { // 通知阅读器重新布局
                    detail: { bookId: tab.bookId, source: "resize-drag" },
                  }),
                );
              }}
            >
              <div className={resolvedSwapSidebars ? "ml-1 h-[calc(100dvh-48px)]" : "mr-1 h-[calc(100dvh-48px)]"}>
                <NotepadContainer bookId={tab.bookId} /> {/* 笔记容器，按书籍 ID 绑定 */}
              </div>
            </Resizable>
          );

          const chatSidebar = isChatVisible && ( // 聊天侧栏条件渲染
            <Resizable
              defaultSize={{
                width: 370, // 默认宽度
                height: "100%", // 占满高度
              }}
              minWidth={320} // 最小宽度
              maxWidth={580} // 最大宽度
              enable={{
                top: false,
                right: resolvedSwapSidebars, // 根据配置决定拖拽手柄位置
                bottom: false,
                left: !resolvedSwapSidebars,
                topRight: false,
                bottomRight: false,
                bottomLeft: false,
                topLeft: false,
              }}
              handleComponent={
                resolvedSwapSidebars
                  ? { right: <div className="custom-resize-handle custom-resize-handle-left" /> } // 侧栏在左时把手在右
                  : { left: <div className="custom-resize-handle" /> } // 侧栏在右时把手在左
              }
              className="h-full"
              onResize={() => {
                if (!showOverlay) {
                  setShowOverlay(true); // 拖拽中显示遮罩
                }
              }}
              onResizeStop={() => {
                setShowOverlay(false); // 停止拖拽隐藏遮罩
                window.dispatchEvent(
                  new CustomEvent("foliate-resize-update", { // 通知阅读器重新布局
                    detail: { bookId: tab.bookId, source: "resize-drag" },
                  }),
                );
              }}
            >
              <div
                className={
                  resolvedSwapSidebars
                    ? "mr-1 h-[calc(100dvh-48px)] rounded-md"
                    : "m-1 mt-0 h-[calc(100dvh-48px)] rounded-md"
                }
              >
                <SideChat key={`chat-${tab.id}`} bookId={tab.bookId} /> {/* 聊天面板，绑定书籍 ID */}
              </div>
            </Resizable>
          );

          return (
            <ReaderProvider store={store} key={tab.id}> {/* 为每个标签提供独立的 ReaderStore */}
              <div
                className="absolute inset-0 flex bg-background p-1"
                style={{
                  visibility: tab.id === activeTabId ? "visible" : "hidden", // 只显示当前激活的标签内容
                  zIndex: tab.id === activeTabId ? 1 : 0, // 激活标签置顶
                }}
              >
                {resolvedSwapSidebars ? chatSidebar : notepadSidebar} {/* 左侧区域：根据配置放置 chat 或 notepad */}

                <div className="relative flex-1 rounded-md border shadow-around">
                  <ReaderViewer /> {/* 主阅读视图 */}

                  {showOverlay && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-md bg-background/80 backdrop-blur-sm dark:bg-neutral-900/60" /> /* 调整大小时的遮罩层 */
                  )}
                </div>

                {resolvedSwapSidebars ? notepadSidebar : chatSidebar} {/* 右侧区域：与左侧互换 */}
              </div>
            </ReaderProvider>
          );
        })}
      </main>

      <SettingsDialog open={isSettingsDialogOpen} onOpenChange={toggleSettingsDialog} /> {/* 设置弹窗 */}
      <ModeSelectionDialog />
    </div>
  );
}
