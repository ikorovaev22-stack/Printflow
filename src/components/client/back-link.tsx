"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackLink({ href }: { href: string }) {
  const router = useRouter();
  return (
    <Button asChild variant="surface" size="icon-lg">
      <Link
        href={href}
        aria-label="Назад"
        onClick={(e) => {
          const sameOrigin = document.referrer.startsWith(location.origin);
          if (sameOrigin && history.length > 1) {
            e.preventDefault();
            router.back();
          }
        }}
      >
        <ChevronLeft />
      </Link>
    </Button>
  );
}
