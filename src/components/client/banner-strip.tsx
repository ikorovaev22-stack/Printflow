"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { bannerSrc } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { Banner } from "@/lib/types";

// Promo banners from the print shop: a swipeable strip edge to edge, each image whole (no cropping — banners carry
// text); a tap opens it full size
export function BannerStrip({ banners, className }: { banners: Banner[]; className?: string }) {
  const [open, setOpen] = useState<Banner | null>(null);
  if (!banners.length) return null;
  return (
    <>
      <ul
        aria-label="Акции и услуги"
        className={cn("-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:-mx-8 md:scroll-px-8 md:px-8", className)}
      >
        {banners.map((b) => (
          <li key={b.id} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setOpen(b)}
              className="block overflow-hidden rounded-card bg-card transition-transform active:scale-98 motion-reduce:active:scale-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bannerSrc(b.path)}
                alt={b.title ?? "Баннер"}
                loading="lazy"
                decoding="async"
                className="h-40 w-auto max-w-[80vw] min-w-24 object-contain"
              />
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent aria-describedby={undefined} className="gap-3 bg-card p-2 sm:max-w-md">
          <DialogTitle className={open?.title ? "px-2 pt-1 pr-10 text-base" : "sr-only"}>{open?.title || "Баннер"}</DialogTitle>
          {open && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerSrc(open.path)} alt={open.title ?? ""} className="max-h-[75dvh] w-full rounded-tile object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
