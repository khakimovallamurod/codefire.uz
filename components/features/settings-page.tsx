"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/controls";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useMe } from "@/lib/hooks/use-session";
import { toast } from "@/lib/toast";

type EditorPreferences = { fontSize: number; tabSize: number; autoSave: boolean };
const STORAGE_KEY = "codefire-editor-preferences";
const DEFAULTS: EditorPreferences = { fontSize: 14, tabSize: 2, autoSave: true };

export function SettingsPage() {
  const t = useTranslations("settings");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const { data: me, isPending } = useMe();
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null && "fontSize" in parsed && "tabSize" in parsed && "autoSave" in parsed) {
          const value = parsed as EditorPreferences;
          if ([12, 14, 16, 18, 20].includes(value.fontSize) && [2, 4].includes(value.tabSize) && typeof value.autoSave === "boolean") {
            setPreferences(value);
          }
        }
      }
    } catch (error) {
      console.error("Could not read editor preferences from local storage.", error);
      toast.error(t("saveFailed"));
    } finally {
      setReady(true);
    }
  }, [t]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error("Could not save editor preferences to local storage.", error);
      toast.error(t("saveFailed"));
    }
  }, [preferences, ready, t]);

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title={t("title")} description={t("description")} />
      <div className="flex flex-col gap-5">
        <Card>
          <div className="border-b border-border px-5 py-4 font-semibold">{t("account")}</div>
          <CardBody>
            {isPending ? <div role="status" className="text-sm text-fg-muted">{t("loading")}</div> : me ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <SettingValue label={t("profile")} value={me.displayName} />
                <SettingValue label={t("username")} value={`@${me.username}`} />
                <SettingValue label={t("email")} value={me.email ?? t("notSet")} />
                <SettingValue label={t("phone")} value={me.phone} />
              </dl>
            ) : <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-fg-muted">{t("signedOut")}</p><Button asChild size="sm"><Link href="/login">{t("signIn")}</Link></Button></div>}
          </CardBody>
        </Card>
        <Card>
          <div className="border-b border-border px-5 py-4 font-semibold">{t("appearance")}</div>
          <CardBody className="divide-y divide-border">
            <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
              <div><p className="font-medium">{t("theme")}</p><p className="mt-1 text-sm text-fg-muted">{t("themeDescription")}</p></div>
              <div className="flex items-center gap-2">
                <Select aria-label={t("theme")} value={theme ?? "system"} onChange={(event) => setTheme(event.target.value)} className="w-36">
                  <option value="light">{t("light")}</option><option value="dark">{t("dark")}</option><option value="system">{t("system")}</option>
                </Select>
                <ThemeToggle />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
              <div><p className="font-medium">{t("language")}</p><p className="mt-1 text-sm text-fg-muted">{t("languageDescription")}</p></div>
              <div className="flex items-center gap-2"><span className="font-mono text-xs uppercase text-fg-subtle">{locale}</span><LocaleSwitcher /></div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <div className="border-b border-border px-5 py-4 font-semibold">{t("editor")}</div>
          <CardBody className="divide-y divide-border">
            <div className="flex flex-wrap items-center justify-between gap-4 py-3 first:pt-0">
              <label htmlFor="editor-font-size" className="font-medium">{t("fontSize")}</label>
              <Select id="editor-font-size" value={preferences.fontSize} disabled={!ready} onChange={(event) => setPreferences((current) => ({ ...current, fontSize: Number(event.target.value) }))} className="w-36">
                {[12, 14, 16, 18, 20].map((size) => <option key={size} value={size}>{t("characters", { count: size })}</option>)}
              </Select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 py-3">
              <label htmlFor="editor-tab-size" className="font-medium">{t("tabSize")}</label>
              <Select id="editor-tab-size" value={preferences.tabSize} disabled={!ready} onChange={(event) => setPreferences((current) => ({ ...current, tabSize: Number(event.target.value) }))} className="w-36">
                {[2, 4].map((size) => <option key={size} value={size}>{size}</option>)}
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
              <div><p className="font-medium">{t("autoSave")}</p><p className="mt-1 text-sm text-fg-muted">{t("autoSaveDescription")}</p></div>
              <Switch checked={preferences.autoSave} disabled={!ready} onCheckedChange={(autoSave) => setPreferences((current) => ({ ...current, autoSave }))} aria-label={t("autoSave")} />
            </div>
          </CardBody>
        </Card>
      </div>
    </PageContainer>
  );
}

function SettingValue({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-sm text-fg-muted">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}
