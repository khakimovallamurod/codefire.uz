import { setRequestLocale } from "next-intl/server";
import { ResetPasswordForm } from "@/components/features/auth/reset-password-form";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ResetPasswordForm />;
}
