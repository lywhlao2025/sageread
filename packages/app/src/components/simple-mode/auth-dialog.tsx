import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/use-i18n";
import { useAuthStore } from "@/store/auth-store";
import { useModeStore } from "@/store/mode-store";
import {
  fetchQuota,
  loginUser,
  registerUser,
  sendSmsCode,
  SimpleModeApiError,
} from "@/services/simple-mode-service";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const PHONE_REGEX = /^\d{6,15}$/;

export default function SimpleModeAuthDialog() {
  const { mode } = useModeStore();
  const { token, hasHydrated, setAuth, setQuota } = useAuthStore();
  const isOpen = hasHydrated && mode === "simple" && !token;
  const t = useT();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCode("");
      setCooldown(0);
      setSending(false);
      setSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const canSend = useMemo(() => !sending && cooldown === 0, [cooldown, sending]);

  const handleSendCode = useCallback(async () => {
    const normalized = phone.trim();
    if (!PHONE_REGEX.test(normalized)) {
      toast.error(t("auth.phone.invalid", "请输入有效手机号"));
      return;
    }
    try {
      setSending(true);
      await sendSmsCode(normalized);
      setCooldown(60);
      toast.success(t("auth.code.sent", "验证码已发送"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || t("auth.code.sendFail", "验证码发送失败"));
    } finally {
      setSending(false);
    }
  }, [phone, t]);

  const handleAuth = useCallback(async () => {
    const normalized = phone.trim();
    if (!PHONE_REGEX.test(normalized)) {
      toast.error(t("auth.phone.invalid", "请输入有效手机号"));
      return;
    }
    if (!code.trim()) {
      toast.error(t("auth.code.required", "请输入验证码"));
      return;
    }

    setSubmitting(true);
    try {
      let auth = null;
      try {
        auth = await registerUser(normalized, code.trim());
      } catch (error) {
        if (error instanceof SimpleModeApiError && error.code === "USER_EXISTS") {
          auth = await loginUser(normalized, code.trim());
        } else {
          throw error;
        }
      }

      setAuth({ token: auth.token, userId: auth.userId, phone: auth.phone });
      try {
        const quota = await fetchQuota();
        setQuota(quota);
      } catch (error) {
        console.warn("Failed to fetch quota:", error);
      }
      toast.success(t("auth.success", "注册成功，已发放 1000 次免费额度"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || t("auth.fail", "注册失败"));
    } finally {
      setSubmitting(false);
    }
  }, [code, phone, setAuth, setQuota, t]);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="max-w-[420px] p-0">
        <DialogHeader className="border-0 px-6 pt-6 pb-0">
          <DialogTitle>{t("auth.title", "手机号注册领取免费额度")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-6 pt-2">
          <p className="text-sm text-muted-foreground">
            {t("auth.subtitle", "注册后立即发放 1000 次免费额度，用完后暂不可用")}
          </p>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">{t("auth.phone.label", "手机号")}</label>
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={t("auth.phone.placeholder", "请输入手机号")}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">{t("auth.code.label", "验证码")}</label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder={t("auth.code.placeholder", "请输入验证码")}
              />
              <Button variant="outline" disabled={!canSend} onClick={handleSendCode}>
                {cooldown > 0
                  ? t("auth.code.resend", "重新发送 {seconds}s", { seconds: cooldown })
                  : t("auth.code.send", "发送验证码")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("auth.code.hint", "同一手机号 1 分钟内仅可申请一次")}
            </p>
          </div>
          <Button className="w-full" disabled={submitting} onClick={handleAuth}>
            {t("auth.submit", "注册并领取")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
