import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFormatter = new Intl.DateTimeFormat("hr-HR", { day: "numeric", month: "short", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("hr-HR", { hour: "2-digit", minute: "2-digit" });

export function formatDate(value: string | number | Date): string {
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | number | Date): string {
  const d = new Date(value);
  return `${dateFormatter.format(d)}, ${timeFormatter.format(d)}`;
}

/** "prije 5 min", "jučer" … */
export function formatRelative(value: string | number | Date): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "upravo";
  if (minutes < 60) return `prije ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `prije ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "jučer";
  if (days < 7) return `prije ${days} dana`;
  return formatDate(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 2 }).format(value);
}

/** Croatian plural forms: 1 pitanje, 2–4 pitanja, 5+ pitanja (with 11–14 exceptions). */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
