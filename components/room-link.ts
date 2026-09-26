/** The guest storefront URL a room's NFC tag / QR code should open. */
export function roomLink(token?: string) {
  if (!token) return "";
  const base =
    process.env.NEXT_PUBLIC_STOREFRONT_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/r/${token}`;
}
