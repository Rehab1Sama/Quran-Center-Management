import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getMeccaToday(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function makeWhatsAppLink(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("966")) return `https://wa.me/${cleaned}`;
  if (cleaned.startsWith("0")) return `https://wa.me/966${cleaned.slice(1)}`;
  return `https://wa.me/${cleaned}`;
}
