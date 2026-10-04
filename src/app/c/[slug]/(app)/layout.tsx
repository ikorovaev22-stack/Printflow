import { TabBar } from "@/components/client/tab-bar";

export default async function AppLayout({ children, params }: LayoutProps<"/c/[slug]">) {
  const { slug } = await params;
  return (
    <>
      {children}
      <TabBar slug={slug} />
    </>
  );
}
