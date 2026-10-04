import { cn } from "@/lib/utils";

// Print-shop halftone texture for dark surfaces: decorative only
export function Halftone({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute -top-10 -right-10 size-56 rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.16)_1.2px,transparent_1.6px)] bg-size-[12px_12px] mask-radial-from-10% mask-radial-to-70%",
        className,
      )}
    />
  );
}
