"use client";

import { createContext, useContext } from "react";
import { STATUSES } from "@/lib/types";

const StatusesContext = createContext(STATUSES);

// The company's order stages for client components (status pickers and filters in the panel)
export function StatusesProvider({ value, children }: { value: typeof STATUSES; children: React.ReactNode }) {
  return <StatusesContext value={value}>{children}</StatusesContext>;
}

export const useStatuses = () => useContext(StatusesContext);
