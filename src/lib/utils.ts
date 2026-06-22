import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseSizeMb(sizeStr: string): number {
  if (!sizeStr) return 0;
  const val = parseFloat(sizeStr);
  if (isNaN(val)) return 0;
  const upper = sizeStr.toUpperCase();
  if (upper.includes('GB')) return val * 1024;
  if (upper.includes('MB')) return val;
  if (upper.includes('KB')) return val / 1024;
  return val / (1024 * 1024);
}

export function formatStorage(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return `${(mb * 1024).toFixed(0)} KB`;
}
