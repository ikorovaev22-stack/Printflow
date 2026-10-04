"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function BackLink({ href }: { href: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        const sameOrigin = document.referrer.startsWith(location.origin);
        if (sameOrigin && history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className="-ml-1.5 mb-1 inline-flex items-center text-sm font-medium text-primary"
    >
      <ChevronLeft className="size-5" /> Назад
    </Link>
  );
}
