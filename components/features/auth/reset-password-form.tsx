"use client";

import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/state";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/endpoints";

export function ResetPasswordForm() {
  const t = useTranslations("resetPassword");
  const [login, setLogin] = useState("");
  const reset = useMutation({ mutationFn: (value: string) => api.auth.requestPasswordReset(value) });

  if (reset.isSuccess) {
    return (
      <div className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <span className="flex size-11 items-center justify-center rounded-lg bg-verdict-ac/10 text-verdict-ac"><CheckCircle2 aria-hidden /></span>
        <h1 className="mt-4 text-2xl font-bold tracking-[-0.03em]">{t("successTitle")}</h1>
        <p className="mt-2 text-fg-muted">{t("successBody")}</p>
        <Button asChild className="mt-6 w-full"><Link href="/login">{t("backToLogin")}</Link></Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <span className="flex size-11 items-center justify-center rounded-lg bg-accent-soft text-accent-text"><KeyRound aria-hidden /></span>
      <h1 className="mt-4 text-2xl font-bold tracking-[-0.03em]">{t("title")}</h1>
      <p className="mt-2 text-sm leading-6 text-fg-muted">{t("description")}</p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); if (login.trim()) reset.mutate(login.trim()); }}>
        {reset.isError && <ErrorState title={t("failed")} />}
        <Field htmlFor="reset-login" label={t("login")} error={login.trim() ? undefined : reset.isIdle ? undefined : t("required")}>
          <Input id="reset-login" autoComplete="username" autoFocus value={login} onChange={(event) => setLogin(event.target.value)} placeholder={t("placeholder")} required />
        </Field>
        <Button type="submit" loading={reset.isPending} disabled={!login.trim()} className="w-full">{t("submit")}</Button>
      </form>
      <p className="mt-6 border-t border-border pt-5 text-center">
        <Link href="/login" className="text-sm font-medium text-accent-text hover:underline">{t("backToLogin")}</Link>
      </p>
    </div>
  );
}
