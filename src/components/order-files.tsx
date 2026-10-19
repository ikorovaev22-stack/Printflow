"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Download, File, FileArchive, FileImage, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteFile, fileUrl, registerFile } from "@/app/actions/files";
import { useTimeZone } from "@/components/time-zone";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FILE_ACCEPT, fileExtension, fileProblem, uploadType } from "@/lib/files";
import { formatDateTime, formatSize } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { OrderFile } from "@/lib/types";

const ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  png: FileImage, jpg: FileImage, jpeg: FileImage, webp: FileImage, tif: FileImage, tiff: FileImage, heic: FileImage, psd: FileImage,
  zip: FileArchive, rar: FileArchive, "7z": FileArchive,
};

type Props = {
  orderId: string;
  companyId: string;
  files: OrderFile[];
  meId: string;
  side: "client" | "staff";
};

// Browser → storage (policies check the order) → registerFile; returns the error to show, or null.
// Check the file with fileProblem first.
export async function uploadOrderFile(file: File, orderId: string, companyId: string) {
  const supabase = createClient();
  const path = `${companyId}/${orderId}/${crypto.randomUUID()}.${fileExtension(file.name)}`;
  const type = uploadType(file.type);
  const { error } = await supabase.storage.from("order-files").upload(path, file, { contentType: type });
  if (error) return "Не удалось загрузить файл";
  return (await registerFile({ orderId, path, name: file.name, size: file.size, mime: type })).error ?? null;
}

// Layouts from the client and proofs from the print shop; new files arrive via realtime → router.refresh()
export function OrderFiles({ orderId, companyId, files, meId, side }: Props) {
  const router = useRouter();
  const timeZone = useTimeZone();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);

  async function upload(list: FileList) {
    for (const file of Array.from(list)) {
      const problem = fileProblem(file);
      if (problem) {
        toast.error(`${file.name}: ${problem}`);
        continue;
      }
      setUploading((u) => [...u, file.name]);
      const error = await uploadOrderFile(file, orderId, companyId);
      setUploading((u) => u.filter((n) => n !== file.name));
      if (error) toast.error(`${file.name}: ${error}`);
      else toast.success(`${file.name} загружен`);
    }
    router.refresh();
  }

  async function download(id: string) {
    const res = await fileUrl(id);
    if (res.url) window.location.assign(res.url);
    else toast.error(res.error ?? "Не удалось скачать файл");
  }

  async function remove(id: string) {
    const res = await deleteFile(id);
    if (res.error) toast.error(res.error);
    router.refresh();
  }

  const who = (f: OrderFile) =>
    f.uploaded_by === meId ? "Вы" : f.from_client ? "Клиент" : side === "client" ? "Типография" : "Сотрудник";

  return (
    <div className="flex flex-col gap-3">
      {files.length > 0 || uploading.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border/70">
          {files.map((f) => {
            const Icon = ICONS[fileExtension(f.name)] ?? File;
            const canDelete = f.uploaded_by === meId || side === "staff";
            return (
              <li key={f.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-tile", f.from_client ? "bg-muted" : "bg-lime text-lime-foreground")}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" title={f.name}>
                    {f.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {who(f)} · {formatSize(f.size)} · {formatDateTime(f.created_at, timeZone)}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => download(f.id)} aria-label={`Скачать ${f.name}`}>
                  <Download />
                </Button>
                {canDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" aria-label={`Удалить ${f.name}`}>
                        <Trash2 />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить файл?</AlertDialogTitle>
                        <AlertDialogDescription>«{f.name}» исчезнет у всех участников заказа.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={() => remove(f.id)}>
                          Удалить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </li>
            );
          })}
          {uploading.map((name) => (
            <li key={name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" aria-live="polite">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-tile bg-muted">
                <Loader2 className="size-5 animate-spin motion-reduce:animate-none" />
              </span>
              <p className="min-w-0 flex-1 truncate text-muted-foreground">{name}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {side === "client" ? "Пришлите макет: PDF, AI, CDR, PSD, TIFF или архив, до 50 МБ" : "Файлов пока нет. Пришлите клиенту пробник на согласование"}
        </p>
      )}
      <Button variant="outline" className="self-start" disabled={uploading.length > 0} onClick={() => inputRef.current?.click()}>
        <Paperclip data-icon="inline-start" /> {side === "client" ? "Прикрепить макет" : "Добавить файл"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) upload(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
