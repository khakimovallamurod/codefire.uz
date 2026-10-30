"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Check, Clock3, GraduationCap, ListChecks, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState, EmptyState } from "@/components/ui/state";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/endpoints";
import type { Course, CourseDetail } from "@/lib/api/types";
import { PageContainer, PageHeader } from "@/components/shell/page";

export function LearningHub({ slug }: { slug?: string }) {
  const t = useTranslations("courses");
  const courses = useQuery({ queryKey: ["courses"], queryFn: () => api.courses.list(), staleTime: 60_000 });
  const course = useQuery({
    queryKey: ["course", slug],
    queryFn: () => api.courses.get(slug ?? ""),
    enabled: !!slug,
    staleTime: 60_000,
  });

  if (slug) {
    if (course.isPending) return <LoadingPage />;
    if (course.isError) {
      return (
        <PageContainer>
          <ErrorState title={t("loadFailed")} action={<Button variant="secondary" onClick={() => void course.refetch()}>{t("retry")}</Button>} />
        </PageContainer>
      );
    }
    return <CourseDetails course={course.data} />;
  }

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("description")} />
      {courses.isPending ? (
        <LoadingPage />
      ) : courses.isError ? (
        <ErrorState title={t("loadFailed")} action={<Button variant="secondary" onClick={() => void courses.refetch()}>{t("retry")}</Button>} />
      ) : courses.data.length === 0 ? (
        <EmptyState icon={<GraduationCap />} title={t("empty")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.data.map((item) => <CourseCard key={item.slug} course={item} />)}
        </div>
      )}
    </PageContainer>
  );
}

function CourseCard({ course }: { course: Course }) {
  const t = useTranslations("courses");
  const common = useTranslations("common");
  const progress = course.progress;
  return (
    <Card className="flex flex-col">
      <CardBody className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent-text"><BookOpen aria-hidden /></span>
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">{common(`level.${course.level}`)}</span>
        </div>
        <h2 className="mt-4 text-lg font-semibold">{course.title}</h2>
        <p className="mt-2 flex-1 text-sm leading-6 text-fg-muted">{course.description}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-xs text-fg-subtle">
          <span className="inline-flex items-center gap-1.5"><ListChecks aria-hidden className="size-3.5" />{t("lessons", { count: course.lessonsCount })}</span>
          <span className="inline-flex items-center gap-1.5"><Clock3 aria-hidden className="size-3.5" />{t("hours", { count: course.hours })}</span>
          <span className="inline-flex items-center gap-1.5"><Users aria-hidden className="size-3.5" />{t("students", { count: course.students })}</span>
          <span>{t("problems", { count: course.problemsCount })}</span>
        </div>
        {progress !== null && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-fg-muted">
              <span>{progress === 100 ? t("completed") : t("progress", { value: progress })}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        <Button asChild className="mt-5 w-full" variant={progress === 100 ? "secondary" : "primary"}>
          <Link href={`/courses/${course.slug}`}>{progress === null ? t("start") : progress === 100 ? t("completed") : t("continue")}</Link>
        </Button>
      </CardBody>
    </Card>
  );
}

function CourseDetails({ course }: { course: CourseDetail }) {
  const t = useTranslations("courses");
  const common = useTranslations("common");
  return (
    <PageContainer>
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link href="/courses"><ArrowLeft aria-hidden />{t("backToCourses")}</Link></Button>
      <PageHeader title={course.title} description={course.description} />
      <div className="mb-6 flex flex-wrap gap-3 text-sm text-fg-muted">
        <span>{common(`level.${course.level}`)}</span><span>·</span><span>{t("lessons", { count: course.lessonsCount })}</span>
        <span>·</span><span>{t("hours", { count: course.hours })}</span>
        {course.progress !== null && <span>· {t("progress", { value: course.progress })}</span>}
      </div>
      <section aria-label={t("curriculum")} className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("curriculum")}</h2>
        {course.modules.map((module, index) => (
          <Card key={`${module.title}-${index}`}>
            <div className="border-b border-border px-4 py-3 font-semibold">{module.title}</div>
            <ol className="divide-y divide-border">
              {module.lessons.map((lesson) => (
                <li key={lesson.slug} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${lesson.done ? "bg-verdict-ac/10 text-verdict-ac" : "bg-surface-2 text-fg-subtle"}`}>
                      {lesson.done ? <Check aria-hidden className="size-4" /> : <span className="text-xs">{lesson.kind === "lesson" ? "•" : "↗"}</span>}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{lesson.title}</span>
                      <span className="text-xs text-fg-subtle">{lesson.kind === "lesson" ? t("lesson") : t("practice")} · {t("minutes", { count: lesson.minutes })}</span>
                    </span>
                  </div>
                  {lesson.problemId && <Button asChild size="sm" variant="secondary"><Link href={`/problems/${lesson.problemId}`}>{t("openProblem")}</Link></Button>}
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </section>
    </PageContainer>
  );
}

function LoadingPage() {
  return <div role="status" className="flex min-h-40 items-center justify-center"><Spinner /><span className="sr-only">Loading</span></div>;
}
