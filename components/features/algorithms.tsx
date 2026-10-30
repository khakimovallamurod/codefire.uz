"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Binary, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Link } from "@/i18n/navigation";
import { PageContainer, PageHeader } from "@/components/shell/page";

const TOPICS = ["binary-search", "two-pointers", "bfs", "dfs", "dynamic-programming", "dijkstra", "segment-tree"] as const;
type Topic = { title: string; category: string; description: string; complexity: string; example: string; href: string };

export function AlgorithmsPage({ slug }: { slug?: string }) {
  const t = useTranslations("algorithms");
  const [search, setSearch] = useState("");
  const topics = TOPICS.map((key) => ({ slug: key, ...t.raw(`topics.${key}`) as Topic }));
  const topic = topics.find((item) => item.slug === slug);

  if (slug) {
    if (!topic) return <PageContainer><ErrorState title={t("notFound")} action={<Button asChild variant="secondary"><Link href="/algorithms">{t("back")}</Link></Button>} /></PageContainer>;
    return (
      <PageContainer className="max-w-4xl">
        <Button asChild variant="ghost" size="sm" className="mb-4"><Link href="/algorithms"><ArrowLeft aria-hidden />{t("back")}</Link></Button>
        <PageHeader title={topic.title} description={topic.description} />
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardBody className="p-5"><p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{t("complexity")}</p><p className="mt-2 font-mono text-xl font-semibold">{topic.complexity}</p></CardBody></Card>
          <Card><CardBody className="p-5"><p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{t("example")}</p><p className="mt-2 leading-6">{topic.example}</p></CardBody></Card>
        </div>
        <Card className="mt-5">
          <div className="border-b border-border px-5 py-4 font-semibold">{t("practiceTitle")}</div>
          <CardBody><p className="text-sm leading-6 text-fg-muted">{t("practiceDescription")}</p><Button asChild className="mt-4"><Link href={topic.href}>{t("openProblems")}<ArrowRight aria-hidden /></Link></Button></CardBody>
        </Card>
      </PageContainer>
    );
  }

  const normalized = search.trim().toLocaleLowerCase();
  const filtered = topics.filter((item) => `${item.title} ${item.category} ${item.description}`.toLocaleLowerCase().includes(normalized));
  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="mb-5 max-w-md"><Input leading={<Search aria-hidden />} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("search")} aria-label={t("search")} /></div>
      {filtered.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <Card key={item.slug} className="flex flex-col">
              <CardBody className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent-text"><Binary aria-hidden /></span>
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">{item.category}</span>
                </div>
                <Link href={`/algorithms/${item.slug}`} className="mt-4 text-lg font-semibold hover:text-accent-text">{item.title}</Link>
                <p className="mt-2 flex-1 text-sm leading-6 text-fg-muted">{item.description}</p>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <code className="font-mono text-xs text-fg-subtle">{item.complexity}</code>
                  <Link href={`/algorithms/${item.slug}`} className="inline-flex items-center gap-1 text-sm text-accent-text hover:underline">{t("learnMore")}<ArrowRight aria-hidden className="size-4" /></Link>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : <EmptyState icon={<Search />} title={t("empty")} />}
    </PageContainer>
  );
}
