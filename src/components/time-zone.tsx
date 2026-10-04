"use client";

import { createContext, useContext } from "react";
import { DEFAULT_TIME_ZONE } from "@/lib/format";

const TimeZoneContext = createContext(DEFAULT_TIME_ZONE);

// The company's time zone for client components (chat times, overdue checks)
export function TimeZoneProvider({ value, children }: { value: string; children: React.ReactNode }) {
  return <TimeZoneContext value={value}>{children}</TimeZoneContext>;
}

export const useTimeZone = () => useContext(TimeZoneContext);
