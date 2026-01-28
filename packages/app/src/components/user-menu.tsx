import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/hooks/use-i18n";
import { useAuthStore } from "@/store/auth-store";
import { User } from "lucide-react";

export default function UserMenu() {
  const t = useT();
  const { token, phone, startSwitchUser } = useAuthStore();

  if (!token) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center rounded-full p-1 text-sm outline-none hover:bg-neutral-200 focus:outline-none focus-visible:ring-0 dark:hover:bg-neutral-700">
          <Avatar className="size-6">
            <AvatarFallback className="bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              <User size={14} />
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" sideOffset={6} className="min-w-48">
        <DropdownMenuLabel>{t("user.menu.current", "当前用户")}</DropdownMenuLabel>
        {phone ? (
          <div className="px-2 pb-1 text-xs text-muted-foreground">{phone}</div>
        ) : (
          <div className="px-2 pb-1 text-xs text-muted-foreground">{t("user.menu.unknown", "未知用户")}</div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => startSwitchUser()}>
          {t("user.menu.switch", "切换用户")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
