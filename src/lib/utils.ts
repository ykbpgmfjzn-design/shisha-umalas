import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalize a customer name by stripping title prefixes (Mr./Mrs./Miss), lowercasing and trimming. */
export function normalizeCustomerName(name: string): string {
  return name.toLowerCase().replace(/^(mr\.?|mrs\.?|miss)\s*/i, "").trim();
}
