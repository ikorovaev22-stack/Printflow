import { OrderForm } from "@/components/admin/order-form";
import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/auth";

export const metadata = { title: "Новый заказ" };

export default async function NewOrderPage({ searchParams }: PageProps<"/admin/orders/new">) {
  const { client } = (await searchParams) as { client?: string };
  const { supabase } = await requireStaff();
  const { data: clients } = await supabase.from("profiles").select("id, full_name, email").eq("role", "client").order("full_name");
  return (
    <>
      <PageHeader title="Новый заказ" />
      <OrderForm clients={clients ?? []} clientId={client} back={client ? `/admin/clients/${client}` : "/admin/orders"} />
    </>
  );
}
