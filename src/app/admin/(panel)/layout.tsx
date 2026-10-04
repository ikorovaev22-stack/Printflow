import { requireStaff } from "@/lib/auth";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  await requireStaff();
  return <>{children}</>;
}
