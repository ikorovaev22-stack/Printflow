import { createCn } from "cn/config"

// Design tokens from globals.css (rounded-tile, rounded-card, shadow-float) must merge like built-in scales
export const cn = createCn({
  extend: { theme: { radius: ["tile", "card"], shadow: ["float"] } },
})
