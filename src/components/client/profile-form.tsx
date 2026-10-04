"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  useEffect(() => {
    if (state?.message) toast.success(state.message);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-card bg-card p-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name">Имя</Label>
        <Input id="full_name" name="full_name" defaultValue={profile.full_name} className="bg-muted border-transparent" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Телефон</Label>
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={profile.phone ?? ""} className="bg-muted border-transparent" />
      </div>
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
        {pending ? "Сохранение…" : "Сохранить"}
      </Button>
    </form>
  );
}
