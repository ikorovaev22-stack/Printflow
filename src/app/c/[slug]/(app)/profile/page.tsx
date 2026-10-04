import Link from "next/link";
import { ChevronRight, LogOut, Store } from "lucide-react";
import { ProfileForm } from "@/components/client/profile-form";
import { PushToggle } from "@/components/push-toggle";
import { SignOutForm } from "@/components/sign-out-form";
import { Screen, SectionTitle } from "@/components/client/screen";
import { requireClient } from "@/lib/auth";
import { initials } from "@/lib/format";

export const metadata = { title: "Профиль" };

export default async function ProfileScreen({ params }: PageProps<"/c/[slug]/profile">) {
  const { slug } = await params;
  const { profile, company } = await requireClient(slug);

  return (
    <Screen eyebrow="Аккаунт" title="Профиль">
      <section className="flex items-center gap-4 rounded-card bg-card p-5">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
          {initials(profile.full_name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{profile.full_name || "Без имени"}</p>
          <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </section>

      <SectionTitle>Личные данные</SectionTitle>
      <ProfileForm profile={profile} />

      <SectionTitle>Уведомления</SectionTitle>
      <PushToggle />

      <SectionTitle>Ещё</SectionTitle>
      <div className="flex flex-col gap-2">
        <Link href={`/c/${slug}/about`} className="flex items-center gap-4 rounded-card bg-card p-4 transition-colors hover:bg-card/70">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
            <Store className="size-5" />
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">О типографии «{company.name.replace(/^.*«|»$/g, "")}»</span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
        <SignOutForm slug={slug}>
          <button
            type="submit"
            className="flex w-full items-center gap-4 rounded-card bg-card p-4 text-left font-medium text-destructive transition-colors hover:bg-card/70"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <LogOut className="size-5" />
            </span>
            Выйти
          </button>
        </SignOutForm>
      </div>
    </Screen>
  );
}
