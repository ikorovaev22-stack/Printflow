"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from "lucide-react";
import { addBanner, deleteBanner, moveBanner, saveBannerTitle } from "@/app/actions/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bannerSrc } from "@/lib/brand";
import { createClient } from "@/lib/supabase/client";
import type { Banner } from "@/lib/types";

const MAX = 10;
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export function BannersManager({ companyId, banners }: { companyId: string; banners: Banner[] }) {
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
      } catch {
        toast.error("Не удалось выполнить действие, обновите страницу");
      }
    });

  async function upload(file: File) {
    if (!EXT[file.type]) return toast.error("Нужна картинка PNG, JPG или WebP");
    if (file.size > 3 * 1024 * 1024) return toast.error("Файл больше 3 МБ");
    setUploading(true);
    const supabase = createClient();
    const path = `${companyId}/banner-${Date.now()}.${EXT[file.type]}`;
    const { error } = await supabase.storage.from("banners").upload(path, file, { contentType: file.type });
    const res = error ? { error: "Не удалось загрузить картинку" } : await addBanner(path);
    setUploading(false);
    if (res.error) toast.error(res.error);
    else toast.success("Баннер добавлен");
  }

  return (
    <section className="mt-6 flex flex-col gap-4 rounded-card bg-card p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Баннеры</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Акции и услуги: клиенты видят их на главном экране приложения и в разделе «О компании». До {MAX} картинок, PNG, JPG или
            WebP до 3 МБ.
          </p>
        </div>
        <Button type="button" variant="outline" disabled={uploading || banners.length >= MAX} onClick={() => fileRef.current?.click()}>
          <ImagePlus /> {uploading ? "Загрузка…" : "Добавить баннер"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload(file);
          }}
        />
      </div>
      {!banners.length ? (
        <p className="rounded-card border-2 border-dashed p-10 text-center text-muted-foreground">Баннеров пока нет</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {banners.map((b, i) => (
            <li key={b.id} className="flex flex-col gap-3 rounded-tile bg-muted p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bannerSrc(b.path)} alt={b.title ?? ""} className="h-44 w-full rounded-tile bg-card object-contain" />
              <Input
                defaultValue={b.title ?? ""}
                placeholder="Подпись (для незрячих и в просмотре)"
                maxLength={120}
                aria-label="Подпись баннера"
                className="bg-card"
                onBlur={(e) => e.target.value.trim() !== (b.title ?? "") && run(() => saveBannerTitle(b.id, e.target.value))}
              />
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" disabled={pending || i === 0} onClick={() => run(() => moveBanner(b.id, -1))} aria-label="Раньше">
                  <ArrowLeft />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending || i === banners.length - 1}
                  onClick={() => run(() => moveBanner(b.id, 1))}
                  aria-label="Позже"
                >
                  <ArrowRight />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto text-destructive"
                  disabled={pending}
                  onClick={() => confirm("Удалить баннер?") && run(() => deleteBanner(b.id))}
                  aria-label="Удалить"
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
