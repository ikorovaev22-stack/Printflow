import Link from "next/link";
import { ChevronRight, Info, LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { ProfileForm } from "@/components/client/profile-form";
import { Screen } from "@/components/client/screen";
import { requireClient } from "@/lib/auth";

export const metadata = { title: "Профиль" };

export default async function ProfileScreen({ params }: PageProps<"/c/[slug]/profile">) {
  const { slug } = await params;
  const { profile, company } = await requireClient(slug);
  const initials = profile.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <Screen title="Профиль">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{profile.full_name || "Без имени"}</p>
          <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </div>
      <ProfileForm profile={profile} />
      <div className="mt-4 overflow-hidden rounded-3xl bg-card">
        <Link href={`/c/${slug}/about`} className="flex items-center gap-3 px-5 py-4 active:bg-muted">
          <Info className="size-5 text-primary" />
          <span className="flex-1">О компании «{company.name.replace(/^.*«|»$/g, "")}»</span>
          <ChevronRight className="size-5 text-muted-foreground/60" />
        </Link>
        <form action={signOut} className="border-t">
          <input type="hidden" name="slug" value={slug} />
          <button type="submit" className="flex w-full items-center gap-3 px-5 py-4 text-left text-destructive active:bg-muted">
            <LogOut className="size-5" /> Выйти
          </button>
        </form>
      </div>
    </Screen>
  );
}
