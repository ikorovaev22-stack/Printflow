import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { requireClient } from "@/lib/auth";

export default async function ClientHome({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const { profile } = await requireClient(slug);
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Здравствуйте, {profile.full_name}</h1>
      <form action={signOut}>
        <input type="hidden" name="slug" value={slug} />
        <Button className="mt-4">Выйти</Button>
      </form>
    </main>
  );
}
