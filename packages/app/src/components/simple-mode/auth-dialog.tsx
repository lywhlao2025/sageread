import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/use-i18n";
import { useAuthStore } from "@/store/auth-store";
import { useModeStore } from "@/store/mode-store";
import {
  fetchQuota,
  loginUser,
  loginEmailUser,
  registerUser,
  registerEmailUser,
  sendSmsCode,
  sendEmailCode,
  SimpleModeApiError,
} from "@/services/simple-mode-service";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const PHONE_REGEX = /^\d{6,15}$/;
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const AUTH_METHOD_KEY = "sageread.auth.method";

const isValidEmail = (value: string): boolean => {
  const trimmed = value.trim();
  if (!EMAIL_REGEX.test(trimmed)) return false;
  if (trimmed.length > 254) return false;
  const [local, domain] = trimmed.split("@");
  if (!local || !domain) return false;
  if (local.length > 64) return false;
  if (domain.startsWith(".") || domain.endsWith(".")) return false;
  if (domain.includes("..")) return false;
  return true;
};

export default function SimpleModeAuthDialog() {
  const { mode } = useModeStore();
  const { token, hasHydrated, isSwitching, setAuth, setQuota, stopSwitchUser } = useAuthStore();
  const shouldOpen = hasHydrated && mode === "simple" && (!token || isSwitching);
  const [dismissed, setDismissed] = useState(false);
  const t = useT();
  const canClose = Boolean(token);

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<"phone" | "email">(() => {
    if (typeof window === "undefined") return "phone";
    const stored = window.localStorage.getItem(AUTH_METHOD_KEY);
    return stored === "email" || stored === "phone" ? stored : "phone";
  });

  useEffect(() => {
    if (!shouldOpen) {
      setCode("");
      setEmail("");
      setCooldown(0);
      setSending(false);
      setSubmitting(false);
      setDismissed(false);
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(AUTH_METHOD_KEY);
        if (stored === "email" || stored === "phone") {
          setMethod(stored);
        }
      }
    }
  }, [shouldOpen]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const canSend = useMemo(() => !sending && cooldown === 0, [cooldown, sending]);

  const getTargetInfo = useCallback(() => {
    const target = method === "phone" ? phone.trim() : email.trim();
    const isValid =
      method === "phone" ? PHONE_REGEX.test(target) : isValidEmail(target);
    const invalidMessage =
      method === "phone"
        ? t("auth.phone.invalid", "请输入有效手机号")
        : t("auth.email.invalid", "请输入有效邮箱");
    return { target, isValid, invalidMessage };
  }, [email, method, phone, t]);

  const persistMethod = useCallback((next: "phone" | "email") => {
    setMethod(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_METHOD_KEY, next);
    }
  }, []);

  const handleSendCode = useCallback(async () => {
    const { target, isValid, invalidMessage } = getTargetInfo();
    if (!isValid) {
      toast.error(invalidMessage);
      return;
    }
    try {
      setSending(true);
      const sendFn = method === "phone" ? sendSmsCode : sendEmailCode;
      await sendFn(target);
      setCooldown(60);
      toast.success(t("auth.code.sent", "验证码已发送"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || t("auth.code.sendFail", "验证码发送失败"));
    } finally {
      setSending(false);
    }
  }, [getTargetInfo, method, t]);

  const handleAuth = useCallback(async () => {
    const { target, isValid, invalidMessage } = getTargetInfo();
    if (!isValid) {
      toast.error(invalidMessage);
      return;
    }
    if (!code.trim()) {
      toast.error(t("auth.code.required", "请输入验证码"));
      return;
    }

    setSubmitting(true);
    try {
      let auth = null;
      const registerFn = method === "phone" ? registerUser : registerEmailUser;
      const loginFn = method === "phone" ? loginUser : loginEmailUser;
      try {
        auth = await registerFn(target, code.trim());
      } catch (error) {
        if (
          error instanceof SimpleModeApiError &&
          (error.code === "USER_EXISTS" || error.code === "HTTP_409")
        ) {
          auth = await loginFn(target, code.trim());
        } else {
          throw error;
        }
      }

      setAuth({ token: auth.token, userId: auth.userId, phone: auth.phone ?? null, email: auth.email ?? null });
      stopSwitchUser();
      try {
        const quota = await fetchQuota();
        setQuota(quota);
      } catch (error) {
        console.warn("Failed to fetch quota:", error);
      }
      toast.success(t("auth.success", "注册成功，已发放 100 次免费额度"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || t("auth.fail", "注册失败"));
    } finally {
      setSubmitting(false);
    }
  }, [code, getTargetInfo, method, setAuth, setQuota, t]);

  return (
    <Dialog
      open={shouldOpen && !dismissed}
      onOpenChange={(open) => {
        if (!open) {
          setDismissed(true);
          stopSwitchUser();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        disableOutsideClose={!canClose}
        className="max-w-[420px] p-0"
      >
        <DialogHeader showCloseButton={canClose} className="border-0 px-6 pt-6 pb-0">
          <DialogTitle>{t("auth.title", "注册/登录领取免费额度")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-6 pt-2">
          <p className="text-sm text-muted-foreground">
            {t("auth.subtitle", "注册后立即发放 100 次免费额度，用完后暂不可用")}
          </p>
          <div className="flex gap-2">
            <Button
              variant={method === "phone" ? "default" : "outline"}
              onClick={() => persistMethod("phone")}
              size="sm"
            >
              {t("auth.method.phone", "手机号")}
            </Button>
            <Button
              variant={method === "email" ? "default" : "outline"}
              onClick={() => persistMethod("email")}
              size="sm"
            >
              {t("auth.method.email", "邮箱")}
            </Button>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              {method === "phone" ? t("auth.phone.label", "手机号") : t("auth.email.label", "邮箱")}
            </label>
            <Input
              value={method === "phone" ? phone : email}
              onChange={(event) =>
                method === "phone" ? setPhone(event.target.value) : setEmail(event.target.value)
              }
              placeholder={
                method === "phone"
                  ? t("auth.phone.placeholder", "请输入手机号")
                  : t("auth.email.placeholder", "请输入邮箱")
              }
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
              {method === "phone"
                ? t("auth.code.hint", "同一手机号 1 分钟内仅可申请一次")
                : t("auth.code.hint.email", "同一邮箱 1 分钟内仅可申请一次")}
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
