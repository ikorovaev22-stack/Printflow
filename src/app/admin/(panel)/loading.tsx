import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <Skeleton className="mb-6 h-9 w-56" />
      <Skeleton className="mb-4 h-9 w-full" />
      <Skeleton className="h-96 w-full rounded-card" />
    </>
  );
}
