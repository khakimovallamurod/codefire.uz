"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Heart, MessageCircle, Shield, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorState, EmptyState } from "@/components/ui/state";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { api } from "@/lib/api/endpoints";
import type { BlogPost, BlogPostDetail, Clan, ClanDetail } from "@/lib/api/types";
import { useMe } from "@/lib/hooks/use-session";
import { toast } from "@/lib/toast";

type CommunitySection = "clans" | "blogs";

export function CommunityHub({ section, slug }: { section: CommunitySection; slug?: string }) {
  return section === "clans" ? <ClansPage slug={slug} /> : <BlogsPage slug={slug} />;
}

function ClansPage({ slug }: { slug?: string }) {
  const t = useTranslations("clans");
  const list = useQuery({ queryKey: ["clans"], queryFn: () => api.clans.list(), staleTime: 60_000 });
  const detail = useQuery({
    queryKey: ["clan", slug],
    queryFn: () => api.clans.get(slug ?? ""),
    enabled: !!slug,
    staleTime: 60_000,
  });
  if (slug) {
    if (detail.isPending) return <Loading />;
    if (detail.isError) return <PageContainer><LoadError title={t("loadFailed")} retry={() => void detail.refetch()} /></PageContainer>;
    return <ClanDetails clan={detail.data} />;
  }
  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("description")} />
      {list.isPending ? <Loading /> : list.isError ? <LoadError title={t("loadFailed")} retry={() => void list.refetch()} /> : list.data.length === 0 ? (
        <EmptyState icon={<Shield />} title={t("empty")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.data.map((clan) => <ClanCard key={clan.slug} clan={clan} />)}
        </div>
      )}
    </PageContainer>
  );
}

function ClanCard({ clan }: { clan: Clan }) {
  const t = useTranslations("clans");
  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex items-start justify-between">
          <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent-text"><Shield aria-hidden /></span>
          <span className="font-mono text-sm text-fg-subtle">#{clan.rank}</span>
        </div>
        <Link href={`/clans/${clan.slug}`} className="mt-4 block text-lg font-semibold hover:text-accent-text">{clan.name}</Link>
        <p className="mt-1 text-sm text-fg-muted">{clan.motto}</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-subtle">
          <span className="inline-flex items-center gap-1.5"><Users aria-hidden className="size-3.5" />{t("membersCount", { count: clan.membersCount })}</span>
          <span>{t("honorCount", { count: clan.honor })}</span>
          {clan.region && <span>{clan.region}</span>}
        </div>
        <p className="mt-3 text-xs text-fg-subtle">{t("leader")}: <Link href={`/users/${clan.leader.username}`} className="text-fg-muted hover:text-accent-text">{clan.leader.displayName}</Link></p>
      </CardBody>
    </Card>
  );
}

function ClanDetails({ clan }: { clan: ClanDetail }) {
  const t = useTranslations("clans");
  const me = useMe();
  const client = useQueryClient();
  const [joinedLocally, setJoinedLocally] = useState(false);
  const join = useMutation({
    mutationFn: () => api.clans.join(clan.slug),
    onSuccess: async () => {
      setJoinedLocally(true);
      toast.success(t("joinedToast", { name: clan.name }));
      await client.invalidateQueries({ queryKey: ["clan", clan.slug] });
      await client.invalidateQueries({ queryKey: ["clans"] });
    },
    onError: () => toast.error(t("joinFailed")),
  });
  const joined = joinedLocally || me.data?.clan?.slug === clan.slug;
  return (
    <PageContainer>
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link href="/clans"><ArrowLeft aria-hidden />{t("backToClans")}</Link></Button>
      <PageHeader
        title={clan.name}
        description={clan.motto}
        actions={me.data && !joined ? <Button loading={join.isPending} onClick={() => join.mutate()}>{t("join")}</Button> : joined ? <Button variant="secondary" disabled>{t("joined")}</Button> : <Button asChild><Link href={`/login?next=/clans/${clan.slug}`}>{t("join")}</Link></Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-6">
          <Card><CardBody><p className="leading-7 text-fg-muted">{clan.description}</p></CardBody></Card>
          <Card>
            <div className="border-b border-border px-4 py-3 font-semibold">{t("members")} <span className="text-sm font-normal text-fg-subtle">({clan.members.length})</span></div>
            <div className="divide-y divide-border">
              {clan.members.map((member) => (
                <div key={member.user.username} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/users/${member.user.username}`} className="font-medium hover:text-accent-text">{member.user.displayName}</Link>
                    <p className="text-xs text-fg-subtle">@{member.user.username}</p>
                  </div>
                  <span className="shrink-0 text-xs text-fg-muted">{t(`role.${member.role}`)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <aside className="flex flex-col gap-4">
          <Card><CardBody className="space-y-3">
            <Stat label={t("members")} value={clan.membersCount.toLocaleString()} />
            <Stat label={t("honor")} value={clan.honor.toLocaleString()} />
            <Stat label={t("rank")} value={`#${clan.rank}`} />
            <Stat label={t("foundedLabel")} value={new Date(clan.createdAt).toLocaleDateString()} />
          </CardBody></Card>
          <Card><div className="border-b border-border px-4 py-3 font-semibold">{t("allies")}</div><CardBody>
            {clan.allies.length ? <ul className="space-y-2">{clan.allies.map((ally) => <li key={ally.slug}><Link className="text-sm text-accent-text hover:underline" href={`/clans/${ally.slug}`}>{ally.name}</Link></li>)}</ul> : <p className="text-sm text-fg-muted">{t("noAllies")}</p>}
          </CardBody></Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function BlogsPage({ slug }: { slug?: string }) {
  const t = useTranslations("blogs");
  const list = useQuery({ queryKey: ["blogs"], queryFn: () => api.blogs.list(), staleTime: 60_000 });
  const detail = useQuery({
    queryKey: ["blog", slug],
    queryFn: () => api.blogs.get(slug ?? ""),
    enabled: !!slug,
    staleTime: 60_000,
  });
  if (slug) {
    if (detail.isPending) return <Loading />;
    if (detail.isError) return <PageContainer><LoadError title={t("loadFailed")} retry={() => void detail.refetch()} /></PageContainer>;
    return <BlogDetails post={detail.data} />;
  }
  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("description")} />
      {list.isPending ? <Loading /> : list.isError ? <LoadError title={t("loadFailed")} retry={() => void list.refetch()} /> : list.data.length === 0 ? (
        <EmptyState icon={<MessageCircle />} title={t("empty")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.data.map((post) => <BlogCard key={post.slug} post={post} />)}
        </div>
      )}
    </PageContainer>
  );
}

function BlogCard({ post }: { post: BlogPost }) {
  const t = useTranslations("blogs");
  return (
    <Card className="flex flex-col">
      <CardBody className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-1.5">{post.tags.map((tag) => <span key={tag} className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-text">{tag}</span>)}</div>
        <Link href={`/blogs/${post.slug}`} className="mt-4 text-lg font-semibold leading-snug hover:text-accent-text">{post.title}</Link>
        <p className="mt-2 flex-1 text-sm leading-6 text-fg-muted">{post.excerpt}</p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-subtle">
          <Link href={`/users/${post.author.username}`} className="hover:text-accent-text">{post.author.displayName}</Link>
          <span>{t("readingTime", { count: post.readingMin })}</span>
        </div>
        <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs text-fg-subtle">
          <span className="inline-flex items-center gap-1"><Heart aria-hidden className="size-3.5" />{post.likes}</span>
          <span className="inline-flex items-center gap-1"><MessageCircle aria-hidden className="size-3.5" />{t("commentsCount", { count: post.commentsCount })}</span>
          <time className="ml-auto">{new Date(post.publishedAt).toLocaleDateString()}</time>
        </div>
      </CardBody>
    </Card>
  );
}

function BlogDetails({ post }: { post: BlogPostDetail }) {
  const t = useTranslations("blogs");
  return (
    <PageContainer className="max-w-4xl">
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link href="/blogs"><ArrowLeft aria-hidden />{t("backToBlogs")}</Link></Button>
      <article>
        <div className="flex flex-wrap gap-2">{post.tags.map((tag) => <span key={tag} className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent-text">{tag}</span>)}</div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{post.title}</h1>
        <p className="mt-3 text-lg leading-7 text-fg-muted">{post.excerpt}</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-5 text-sm text-fg-subtle">
          <Link href={`/users/${post.author.username}`} className="font-medium text-fg hover:text-accent-text">{post.author.displayName}</Link>
          <span>·</span><time>{new Date(post.publishedAt).toLocaleDateString()}</time><span>·</span><span>{t("readingTime", { count: post.readingMin })}</span>
        </div>
        <div className="prose-cf mt-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </div>
      </article>
      <BlogActions post={post} />
    </PageContainer>
  );
}

function BlogActions({ post }: { post: BlogPostDetail }) {
  const t = useTranslations("blogs");
  const me = useMe();
  const client = useQueryClient();
  const [text, setText] = useState("");
  const like = useMutation({
    mutationFn: () => api.blogs.like(post.slug, !post.liked),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["blog", post.slug] });
      void client.invalidateQueries({ queryKey: ["blogs"] });
    },
    onError: () => toast.error(t("likeFailed")),
  });
  const comment = useMutation({
    mutationFn: (body: string) => api.blogs.comment(post.slug, body),
    onSuccess: async () => {
      setText("");
      toast.success(t("commentPosted"));
      await client.invalidateQueries({ queryKey: ["blog", post.slug] });
      await client.invalidateQueries({ queryKey: ["blogs"] });
    },
    onError: () => toast.error(t("commentFailed")),
  });
  return (
    <section className="mt-8 border-t border-border pt-6">
      <Button variant={post.liked ? "primary" : "secondary"} loading={like.isPending} onClick={() => like.mutate()}>
        <Heart aria-hidden className={post.liked ? "fill-current" : ""} />{t("like")} · {post.likes}
      </Button>
      <div className="mt-8">
        <h2 className="text-xl font-semibold">{t("comments")} <span className="text-base font-normal text-fg-subtle">({post.comments.length})</span></h2>
        {me.data ? (
          <form onSubmit={(event) => { event.preventDefault(); if (text.trim()) comment.mutate(text.trim()); }} className="mt-4 flex gap-2">
            <Input aria-label={t("writeComment")} value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} placeholder={t("writeComment")} />
            <Button type="submit" disabled={!text.trim()} loading={comment.isPending}>{t("postComment")}</Button>
          </form>
        ) : <p className="mt-3 text-sm text-fg-muted">{t("signInToComment")} <Link href={`/login?next=/blogs/${post.slug}`} className="text-accent-text hover:underline">{t("signIn")}</Link></p>}
        {post.comments.length ? (
          <ul className="mt-5 divide-y divide-border">
            {post.comments.map((item) => (
              <li key={item.id} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/users/${item.author.username}`} className="font-medium hover:text-accent-text">{item.author.displayName}</Link>
                  <time className="text-xs text-fg-subtle">{new Date(item.at).toLocaleDateString()}</time>
                </div>
                <p className="mt-2 text-sm leading-6 text-fg-muted">{item.text}</p>
              </li>
            ))}
          </ul>
        ) : <p className="mt-4 text-sm text-fg-muted">{t("noComments")}</p>}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-fg-muted">{label}</span><span className="font-semibold">{value}</span></div>;
}

function LoadError({ title, retry }: { title: string; retry: () => void }) {
  const t = useTranslations("common");
  return <ErrorState title={title} action={<Button variant="secondary" onClick={retry}>{t("retry")}</Button>} />;
}

function Loading() {
  return <div role="status" className="flex min-h-40 items-center justify-center"><Spinner /><span className="sr-only">Loading</span></div>;
}
