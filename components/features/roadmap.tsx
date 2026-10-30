"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Map, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/controls";
import { Link } from "@/i18n/navigation";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { toast } from "@/lib/toast";

type RoadmapStep = { title: string; description: string; href: string };
type TrackContent = { title: string; description: string; steps: RoadmapStep[] };
const TRACKS = ["fundamentals", "structures", "algorithms"] as const;
const ALL_IDS = TRACKS.flatMap((track) => Array.from({ length: 4 }, (_, index) => `${track}-${index}`));
const STORAGE_KEY = "codefire-roadmap-progress";

export function RoadmapPage() {
  const t = useTranslations("roadmap");
  const [done, setDone] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const tracks = TRACKS.map((key) => ({ key, ...t.raw(`tracks.${key}`) as TrackContent }));

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(saved)) setDone(saved.filter((item): item is string => typeof item === "string" && ALL_IDS.includes(item)));
    } catch (error) {
      console.error("Could not read roadmap progress from local storage.", error);
      toast.error(t("storageError"));
    } finally {
      setReady(true);
    }
  }, [t]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
    } catch (error) {
      console.error("Could not save roadmap progress to local storage.", error);
      toast.error(t("storageError"));
    }
  }, [done, ready, t]);

  const toggle = (id: string, checked: boolean) => {
    setDone((current) => checked ? [...new Set([...current, id])] : current.filter((value) => value !== id));
  };
  const clear = () => {
    if (window.confirm(t("resetConfirm"))) setDone([]);
  };
  const total = ALL_IDS.length;
  const progress = total ? Math.round((done.length / total) * 100) : 0;

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={<Button variant="secondary" size="sm" onClick={clear} disabled={!ready || done.length === 0}><RotateCcw aria-hidden />{t("clear")}</Button>}
      />
      <Card className="mb-6">
        <CardBody className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent-text"><Map aria-hidden /></span>
              <div><p className="font-semibold">{t("progress", { done: done.length, total })}</p><p className="mt-0.5 text-sm text-fg-muted">{progress}%</p></div>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress}%` }} /></div>
        </CardBody>
      </Card>
      <div className="relative flex flex-col gap-5">
        <span aria-hidden className="absolute top-8 bottom-8 left-5 hidden w-px bg-border sm:block" />
        {tracks.map((track, trackIndex) => (
          <Card key={track.key} className="relative">
            <div className="flex items-start gap-4 border-b border-border p-4 sm:p-5">
              <span className="z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface font-mono text-sm font-semibold text-accent-text">{trackIndex + 1}</span>
              <div><h2 className="text-lg font-semibold">{track.title}</h2><p className="mt-1 text-sm text-fg-muted">{track.description}</p></div>
            </div>
            <ol className="divide-y divide-border">
              {track.steps.map((step, index) => {
                const id = `${track.key}-${index}`;
                const checked = done.includes(id);
                return (
                  <li key={id} className="flex items-start gap-3 px-4 py-4 sm:px-5">
                    <Checkbox checked={checked} disabled={!ready} onCheckedChange={(value) => toggle(id, value)} aria-label={t("markComplete", { title: step.title })} className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium ${checked ? "text-fg-muted line-through" : ""}`}>{step.title}</p>
                      <p className="mt-1 text-sm leading-6 text-fg-muted">{step.description}</p>
                    </div>
                    <Link href={step.href} aria-label={`${step.title} — ${t("openResource")}`} className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-sm text-accent-text hover:underline">
                      <span className="hidden sm:inline">{t("openResource")}</span><ArrowRight aria-hidden className="size-4" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Card>
        ))}
      </div>
      {ready && done.length === total && <p className="mt-5 flex items-center gap-2 text-sm font-medium text-verdict-ac"><CheckCircle2 aria-hidden className="size-4" />{t("finished")}</p>}
    </PageContainer>
  );
}
