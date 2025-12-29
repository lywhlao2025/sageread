import { useT } from "@/hooks/use-i18n";
import { useAppSettingsStore } from "@/store/app-settings-store";
import clsx from "clsx";
import { BarChart3, Brain, Library, Lightbulb, Settings } from "lucide-react";
import { Link, useLocation } from "react-router";

interface NavigationItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface ActionButtonItem {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
}

export default function Sidebar() {
  const t = useT();
  const location = useLocation();
  const { toggleSettingsDialog } = useAppSettingsStore();

  const navigationItems: NavigationItem[] = [
    {
      path: "/",
      label: t("nav.library", "图书馆"),
      icon: Library,
    },
    {
      path: "/chat",
      label: t("nav.chat", "聊天"),
      icon: Brain,
    },
    {
      path: "/skills",
      label: t("nav.skills", "技能库"),
      icon: Lightbulb,
    },
    {
      path: "/statistics",
      label: t("nav.stats", "阅读统计"),
      icon: BarChart3,
    },
  ];

  const actionButtons: ActionButtonItem[] = [
    {
      label: t("nav.settings", "设置"),
      icon: Settings,
      onClick: toggleSettingsDialog,
    },
  ];

  return (
    <>
      <aside className="z-40 flex h-full w-48 select-none flex-col overflow-hidden border-neutral-200">
        <nav className="flex flex-1 flex-col space-y-1 overflow-y-auto px-1 py-4 pt-2 pl-2">
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <div key={item.path}>
                <Link
                  to={item.path}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-md p-1 py-1 text-left text-sm transition-colors hover:bg-border",
                    isActive ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-700 dark:text-neutral-300",
                  )}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="space-y-1 px-2 py-3">
          {actionButtons.map((button, index) => {
            const Icon = button.icon;

            return (
              <button
                key={index}
                onClick={button.onClick}
                className="flex w-full items-center gap-2 rounded-md p-1 py-1 text-left text-neutral-600 text-sm hover:bg-border dark:text-neutral-300"
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="text-sm">{button.label}</span>
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}
