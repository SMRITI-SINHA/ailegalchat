import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Strip HTML tags from text content
 */
export function stripHtmlTags(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Determine if a legal document is from "New Laws" (2023 onwards)
 * New Laws: BNS, BNSS, BSA (Bharatiya Nyaya/Nagarik Suraksha/Sakshya Adhiniyam)
 * Old Laws: IPC, CrPC, Evidence Act
 */
export function isNewLaw(title: string | undefined | null): boolean {
  if (!title) return false;
  const lowerTitle = title.toLowerCase();
  
  // New Laws keywords (2023 legislation)
  const newLawKeywords = [
    "bharatiya nyaya sanhita",
    "bharatiya nagarik suraksha sanhita",
    "bharatiya sakshya adhiniyam",
    "bns",
    "bnss",
    "bsa",
    "2023",
    "2024",
    "2025",
    "2026",
  ];
  
  // Old Laws keywords (pre-2023 legislation)
  const oldLawKeywords = [
    "indian penal code",
    "ipc",
    "code of criminal procedure",
    "crpc",
    "cr.p.c",
    "evidence act",
    "indian evidence act",
    "1860",
    "1861",
    "1872",
    "1973",
  ];
  
  // Check for new law indicators first
  for (const keyword of newLawKeywords) {
    if (lowerTitle.includes(keyword)) {
      return true;
    }
  }
  
  // If it contains old law keywords, it's old
  for (const keyword of oldLawKeywords) {
    if (lowerTitle.includes(keyword)) {
      return false;
    }
  }
  
  // Default: if no specific indicator, classify as old (most case law is old)
  return false;
}
