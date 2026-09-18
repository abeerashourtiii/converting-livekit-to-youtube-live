// ↔ page-menu / openExternalService() in app-viewer.html — same support
// number and message-building logic, now shared between the menu screen
// and components/menu/AdBannerCarousel.tsx instead of being local to one file.
export const SUPPORT_PHONE = "201117107131";

export function waLink(message: string) {
  return `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(message)}`;
}
