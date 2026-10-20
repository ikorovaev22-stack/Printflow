import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main
      className="mx-auto max-w-md px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-28 md:max-w-2xl md:px-8 md:pt-[max(env(safe-area-inset-top),2.5rem)] lg:max-w-3xl"
      aria-busy="true"
    >
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="h-5 w-32" />
      </div>
      <Skeleton className="mb-2 h-5 w-40" />
      <Skeleton className="mb-6 h-9 w-56" />
      <div className="mb-5 flex gap-2">
        <Skeleton className="h-11 w-28 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-20 rounded-card" />
      </div>
    </main>
  );
}
