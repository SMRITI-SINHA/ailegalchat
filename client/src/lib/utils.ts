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
 * Check if content appears to already be HTML
 */
function isHtml(text: string): boolean {
  if (!text) return false;
  // Check for common HTML tags
  return /<(div|p|h[1-6]|ul|ol|li|strong|em|br|span|table)[^>]*>/i.test(text);
}

/**
 * Convert markdown to properly formatted HTML for legal documents
 * Handles headers, bold, italic, lists, paragraphs with proper spacing
 */
export function markdownToHtml(markdown: string | undefined | null): string {
  if (!markdown) return "";
  
  // If already HTML, return as-is to avoid double-processing
  if (isHtml(markdown)) return markdown;
  
  let html = markdown;
  
  // Normalize line endings
  html = html.replace(/\r\n/g, '\n');
  
  // Convert horizontal rules
  html = html.replace(/^---+$/gm, '<hr style="margin: 2em 0; border: none; border-top: 1px solid #ccc;">');
  
  // Convert headers (must be done before other processing)
  html = html.replace(/^######\s+(.+)$/gm, '<h6 style="margin: 1.5em 0 0.5em 0; font-size: 0.85em; font-weight: bold;">$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5 style="margin: 1.5em 0 0.5em 0; font-size: 0.9em; font-weight: bold;">$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4 style="margin: 1.5em 0 0.5em 0; font-size: 1em; font-weight: bold;">$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 style="margin: 1.5em 0 0.5em 0; font-size: 1.1em; font-weight: bold;">$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 style="margin: 1.5em 0 0.5em 0; font-size: 1.25em; font-weight: bold;">$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1 style="margin: 1.5em 0 0.5em 0; font-size: 1.5em; font-weight: bold;">$1</h1>');
  
  // Process line by line - handle lists BEFORE emphasis to avoid * being treated as italic
  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inOrderedList = false;
  let inUnorderedList = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Check for list items FIRST (before emphasis processing)
    const orderedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    
    if (orderedMatch) {
      if (!inOrderedList) {
        if (inUnorderedList) {
          processedLines.push('</ul>');
          inUnorderedList = false;
        }
        processedLines.push('<ol style="margin: 1em 0; padding-left: 2em;">');
        inOrderedList = true;
      }
      // Apply emphasis to the list item content
      let itemContent = orderedMatch[2];
      itemContent = itemContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      itemContent = itemContent.replace(/__([^_]+)__/g, '<strong>$1</strong>');
      itemContent = itemContent.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      itemContent = itemContent.replace(/_([^_]+)_/g, '<em>$1</em>');
      processedLines.push(`<li style="margin: 0.5em 0;">${itemContent}</li>`);
    } else if (unorderedMatch) {
      if (!inUnorderedList) {
        if (inOrderedList) {
          processedLines.push('</ol>');
          inOrderedList = false;
        }
        processedLines.push('<ul style="margin: 1em 0; padding-left: 2em;">');
        inUnorderedList = true;
      }
      // Apply emphasis to the list item content
      let itemContent = unorderedMatch[1];
      itemContent = itemContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      itemContent = itemContent.replace(/__([^_]+)__/g, '<strong>$1</strong>');
      itemContent = itemContent.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      itemContent = itemContent.replace(/_([^_]+)_/g, '<em>$1</em>');
      processedLines.push(`<li style="margin: 0.5em 0;">${itemContent}</li>`);
    } else {
      if (inOrderedList) {
        processedLines.push('</ol>');
        inOrderedList = false;
      }
      if (inUnorderedList) {
        processedLines.push('</ul>');
        inUnorderedList = false;
      }
      
      // Handle empty lines as paragraph breaks
      if (line.trim() === '') {
        processedLines.push('<br><br>');
      } else if (!line.startsWith('<h') && !line.startsWith('<hr')) {
        // Apply emphasis AFTER list check for regular paragraphs
        line = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        line = line.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        line = line.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        line = line.replace(/_([^_]+)_/g, '<em>$1</em>');
        // Wrap non-header content in paragraph
        processedLines.push(`<p style="margin: 0.75em 0; line-height: 1.6;">${line}</p>`);
      } else {
        processedLines.push(line);
      }
    }
  }
  
  // Close any open lists
  if (inOrderedList) processedLines.push('</ol>');
  if (inUnorderedList) processedLines.push('</ul>');
  
  html = processedLines.join('\n');
  
  // Clean up multiple consecutive br tags
  html = html.replace(/(<br><br>\s*)+/g, '<br><br>');
  
  // Remove empty paragraphs
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');
  
  return html;
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
