"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ImageUp, Package, X } from "lucide-react";
import { toast } from "sonner";
import { saveCompany } from "@/app/actions/company";
import { CompanyLogo } from "@/components/company-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brandStyle } from "@/lib/brand";
import { createClient } from "@/lib/supabase/client";
import type { Company } from "@/lib/types";

const TIME_ZONES = [
  ["Europe/Kaliningrad", "Калининград (UTC+2)"],
  ["Europe/Moscow", "Москва (UTC+3)"],
  ["Europe/Samara", "Самара (UTC+4)"],
  ["Asia/Yekaterinburg", "Екатеринбург (UTC+5)"],
  ["Asia/Omsk", "Омск (UTC+6)"],
  ["Asia/Novosibirsk", "Новосибирск (UTC+7)"],
  ["Asia/Krasnoyarsk", "Красноярск (UTC+7)"],
  ["Asia/Irkutsk", "Иркутск (UTC+8)"],
  ["Asia/Yakutsk", "Якутск (UTC+9)"],
  ["Asia/Vladivostok", "Владивосток (UTC+10)"],
  ["Asia/Magadan", "Магадан (UTC+11)"],
  ["Asia/Kamchatka", "Камчатка (UTC+12)"],
  ["Europe/Minsk", "Минск (UTC+3)"],
  ["Asia/Almaty", "Алматы (UTC+5)"],
  ["Asia/Tashkent", "Ташкент (UTC+5)"],
];

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
      <form action={action} className="flex flex-col gap-6 rounded-card bg-card p-6 md:p-8">
        <input type="hidden" name="logo_url" value={logo ?? ""} />
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold">Бренд</h2>
          <div className="flex items-center gap-4">
            <CompanyLogo company={{ id: company.id, name, logo_url: logo }} className="size-16 rounded-full text-2xl" />
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
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
            </div>
          </div>
          <Field label="Название" name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
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
          <Field label="Телефон" name="phone" type="tel" defaultValue={company.phone ?? ""} maxLength={40} />
          <Field label="Email" name="email" type="email" defaultValue={company.email ?? ""} maxLength={254} />
          <Field label="Telegram" name="telegram" defaultValue={company.telegram ? `@${company.telegram}` : ""} placeholder="@typography" maxLength={60} />
          <Field label="Часы работы" name="work_hours" defaultValue={company.work_hours ?? ""} placeholder="Пн–Пт 9:00–20:00" maxLength={200} />
          <Field label="Адрес" name="address" defaultValue={company.address ?? ""} maxLength={300} className="md:col-span-2" />
          <div className="flex flex-col gap-2">
            <Label htmlFor="timezone">Часовой пояс</Label>
            <Select name="timezone" defaultValue={company.timezone}>
              <SelectTrigger id="timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(TIME_ZONES.some(([tz]) => tz === company.timezone) ? TIME_ZONES : [[company.timezone, company.timezone], ...TIME_ZONES]).map(
                    ([tz, label]) => (
                      <SelectItem key={tz} value={tz}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </section>
        <div>
          <Button type="submit" disabled={pending || uploading}>
            {pending ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </form>

      <aside>
        <p className="mb-3 text-sm font-medium text-muted-foreground">Предпросмотр приложения</p>
        <div
          style={validColor ? brandStyle(color) : undefined}
          className="brand-scope overflow-hidden rounded-[2.5rem] border-[10px] border-primary bg-background pb-4"
        >
          <div className="flex items-center gap-2.5 px-4 pt-5">
            <CompanyLogo company={{ id: company.id, name, logo_url: logo }} className="size-9 rounded-full text-sm" />
            <span className="min-w-0 truncate text-sm font-semibold">{name || "Типография"}</span>
          </div>
          <p className="mt-4 px-4 text-xs text-muted-foreground">Добрый день, Анна</p>
          <p className="px-4 text-xl font-bold tracking-tight">Ваши заказы</p>
          <div className="mx-4 mt-3 rounded-[1.25rem] bg-hero p-4 text-hero-foreground">
            <p className="text-[10px] text-white/60">Заказ №12</p>
            <p className="text-sm font-semibold">Визитки 500 шт.</p>
            <div className="mt-3 flex gap-1">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${i < 3 ? "bg-white" : "bg-white/20"}`} />
              ))}
            </div>
          </div>
          <div className="mx-4 mt-2 flex items-center gap-3 rounded-[1.25rem] bg-card p-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <Package className="size-4" />
            </span>
            <span className="text-xs font-medium">Этап «Печать» — сейчас</span>
          </div>
          <div className="mx-4 mt-4 flex items-center justify-between rounded-full bg-card p-1 shadow-float">
            <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[10px] font-medium text-primary-foreground">
              <Package className="size-3.5" /> Заказы
            </span>
            <span className="size-2 rounded-full bg-muted-foreground/30" />
            <span className="size-2 rounded-full bg-muted-foreground/30" />
            <span className="mr-3 size-2 rounded-full bg-muted-foreground/30" />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Фирменный цвет — акцент: текущий этап, иконки и непрочитанные. Основные кнопки остаются тёмными.</p>
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
