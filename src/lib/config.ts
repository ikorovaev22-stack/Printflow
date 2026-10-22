// Template-wide settings, all from environment variables (see .env.example)
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Арт Проджект";

// Public URL used in notification links; falls back to relative links when unset
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
