import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth";

export default async function OrdersPage() {
  const { profile, company } = await requireStaff();
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">{company.name}</h1>
      <p className="text-muted-foreground">{profile.full_name} · {profile.role}</p>
      <form action={signOut}><Button variant="outline" className="mt-4">Выйти</Button></form>
    </main>
  );
}
