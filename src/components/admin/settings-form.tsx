"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ImageUp, Package, X } from "lucide-react";
import { toast } from "sonner";
import { saveCompany } from "@/app/actions/company";
import { CompanyLogo } from "@/components/company-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brandStyle } from "@/lib/brand";
import { createClient } from "@/lib/supabase/client";
import type { Company } from "@/lib/types";

const PRESETS = ["#4f46e5", "#2563eb", "#0891b2", "#059669", "#65a30d", "#d97706", "#dc2626", "#db2777", "#7c3aed", "#18181b"];

export function SettingsForm({ company }: { company: Company }) {
  const [state, action, pending] = useActionState(saveCompany, undefined);
  const [name, setName] = useState(company.name);
  const [color, setColor] = useState(company.brand_color);
  const [logo, setLogo] = useState(company.logo_url);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const validColor = /^#[0-9a-fA-F]{6}$/.test(color);

  useEffect(() => {
    if (state?.message) toast.success(state.message);
    if (state?.error) toast.error(state.error);
  }, [state]);

  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) return toast.error("Файл больше 2 МБ");
    setUploading(true);
    const supabase = createClient();
    const path = `${company.id}/logo-${Date.now()}.${file.name.split(".").pop()?.toLowerCase() || "png"}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) return toast.error("Не удалось загрузить логотип");
    setLogo(supabase.storage.from("logos").getPublicUrl(path).data.publicUrl);
    toast.info("Логотип загружен — не забудьте сохранить");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form action={action} className="flex flex-col gap-6 rounded-xl border bg-card p-6">
        <input type="hidden" name="logo_url" value={logo ?? ""} />
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold">Бренд</h2>
          <div className="flex items-center gap-4">
            <CompanyLogo company={{ id: company.id, name, logo_url: logo }} className="size-16 rounded-2xl text-2xl" />
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <ImageUp /> {uploading ? "Загрузка…" : "Загрузить логотип"}
              </Button>
              {logo && (
                <Button type="button" variant="ghost" onClick={() => setLogo(null)}>
                  <X /> Убрать
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
            </div>
          </div>
          <Field label="Название" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="flex flex-col gap-2">
            <Label>Фирменный цвет</Label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="size-8 rounded-full ring-offset-2 ring-offset-background transition data-[active=true]:ring-2"
                  data-active={c === color}
                  style={{ background: c, "--tw-ring-color": c } as React.CSSProperties}
                  aria-label={c}
                />
              ))}
              <input type="color" value={validColor ? color : "#000000"} onChange={(e) => setColor(e.target.value)} className="size-8 cursor-pointer rounded-full border-0 bg-transparent p-0" />
              <Input name="brand_color" value={color} onChange={(e) => setColor(e.target.value)} className="w-28 font-mono" />
            </div>
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          <h2 className="font-semibold md:col-span-2">Контакты</h2>
          <Field label="Телефон" name="phone" defaultValue={company.phone ?? ""} />
          <Field label="Email" name="email" type="email" defaultValue={company.email ?? ""} />
          <Field label="Адрес" name="address" defaultValue={company.address ?? ""} className="md:col-span-2" />
          <Field label="Часы работы" name="work_hours" defaultValue={company.work_hours ?? ""} placeholder="Пн–Пт 9:00–20:00" className="md:col-span-2" />
        </section>
        <div>
          <Button type="submit" disabled={pending || uploading}>
            {pending ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </form>

      <aside>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Предпросмотр приложения</p>
        <div style={validColor ? brandStyle(color) : undefined} className="overflow-hidden rounded-[2rem] border-8 border-zinc-900 bg-muted/40 shadow-xl">
          <div className="flex items-center justify-between px-4 pt-5 pb-3">
            <span className="text-xl font-bold">Мои заказы</span>
            <CompanyLogo company={{ id: company.id, name, logo_url: logo }} className="size-8 text-sm" />
          </div>
          <div className="mx-4 rounded-2xl bg-card p-3 shadow-sm">
            <p className="text-[10px] text-muted-foreground">Заказ №12</p>
            <p className="text-sm font-semibold">Визитки 500 шт.</p>
            <div className="mt-2 flex gap-1">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${i < 3 ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
          </div>
          <div className="mx-4 mt-3 rounded-xl bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground">Задать вопрос</div>
          <div className="mt-5 grid grid-cols-4 border-t bg-background py-2 text-center text-[10px] text-muted-foreground">
            <span className="flex flex-col items-center text-primary">
              <Package className="size-4" />
              Заказы
            </span>
            <span>Чат</span>
            <span>FAQ</span>
            <span>Профиль</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, className, ...props }: { label: string } & React.ComponentProps<"input">) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} {...props} />
    </div>
  );
}
