"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Camera, FolderOpen, Images, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FILE_ACCEPT, withExtension } from "@/lib/files";

type Source = "photos" | "camera" | "files";

const SOURCES = [
  { value: "photos", label: "Фото из галереи", icon: Images },
  { value: "camera", label: "Сделать фото", icon: Camera },
  { value: "files", label: "Файл с телефона или из облака", icon: FolderOpen },
] as const;

// Phones and tablets get a choice of sources instead of the system file dialog
const useTouch = () =>
  useSyncExternalStore(
    () => () => {},
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );

type Props = {
  label: string;
  inputLabel: string;
  disabled?: boolean;
  className?: string;
  onPick: (files: File[]) => void;
};

// Layouts and photos for an order; check each file with fileProblem
export function FilePicker({ label, inputLabel, disabled, className, onPick }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const touch = useTouch();

  function open(source: Source) {
    const input = inputRef.current;
    if (!input) return;
    // No filter for files on phones: given the list of extensions, some apps offer only the camera and photos
    input.accept = source === "files" ? (touch ? "" : FILE_ACCEPT) : "image/*";
    if (source === "camera") input.setAttribute("capture", "environment");
    else input.removeAttribute("capture");
    input.click();
  }

  const button = (
    <Button variant="outline" className={className} disabled={disabled} onClick={touch ? undefined : () => open("files")}>
      <Paperclip data-icon="inline-start" /> {label}
    </Button>
  );

  return (
    <>
      {touch ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
          <DropdownMenuContent className="w-auto">
            {SOURCES.map(({ value, label, icon: Icon }) => (
              <DropdownMenuItem key={value} className="gap-2.5 py-2.5 text-base" onSelect={() => open(value)}>
                <Icon /> {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        button
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        aria-label={inputLabel}
        onChange={(e) => {
          if (e.target.files?.length) onPick(Array.from(e.target.files, withExtension));
          e.target.value = "";
        }}
      />
    </>
  );
}

// Desktop: files dropped onto the block go the same way as picked ones
export function useFileDrop(onPick: (files: File[]) => void, disabled?: boolean) {
  const [over, setOver] = useState(false);
  const accepts = (e: React.DragEvent) => !disabled && e.dataTransfer.types.includes("Files");
  return {
    over,
    props: {
      onDragOver(e: React.DragEvent) {
        if (!accepts(e)) return;
        e.preventDefault();
        setOver(true);
      },
      onDragLeave(e: React.DragEvent) {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      },
      onDrop(e: React.DragEvent) {
        if (!accepts(e)) return;
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) onPick(Array.from(e.dataTransfer.files, withExtension));
      },
    },
  };
}
