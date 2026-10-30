import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CommunityHub } from "@/components/features/community-hub";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("blogs"), robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug?: string[] }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <CommunityHub section="blogs" slug={slug?.[0]} />;
}
