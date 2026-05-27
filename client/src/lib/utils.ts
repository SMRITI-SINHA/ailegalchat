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
  let lastWasBlank = false;

  // Shared helper: apply all inline formatting (bold, italic, code, links)
  const applyInline = (text: string): string => {
    // Bold / italic (order matters — ** before *)
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
    // Inline code (before link processing so URLs inside code aren't linkified)
    text = text.replace(/`([^`]+)`/g,
      '<code style="background:rgba(0,0,0,.07);padding:.15em .4em;border-radius:3px;font-size:.875em;font-family:monospace;word-break:break-all;">$1</code>');
    // Markdown links [text](url)
    text = text.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;word-break:break-all;">$1</a>'
    );
    // Bare URLs not already inside an href attribute
    text = text.replace(
      /(?<![="'/])(https?:\/\/[\w\-.~:/?#[\]@!$&'()*+,;=%]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;word-break:break-all;">$1</a>'
    );
    return text;
  };
  
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
      processedLines.push(`<li style="margin: 0.5em 0;">${applyInline(orderedMatch[2])}</li>`);
    } else if (unorderedMatch) {
      if (!inUnorderedList) {
        if (inOrderedList) {
          processedLines.push('</ol>');
          inOrderedList = false;
        }
        processedLines.push('<ul style="margin: 1em 0; padding-left: 2em;">');
        inUnorderedList = true;
      }
      processedLines.push(`<li style="margin: 0.5em 0;">${applyInline(unorderedMatch[1])}</li>`);
    } else {
      // Before closing any open list, look ahead to check if the next non-blank
      // line continues the same type of list. If so, stay inside the list so
      // blank lines between items don't restart the counter at 1.
      const nextNonBlankLine = (() => {
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() !== '') return lines[j];
        }
        return '';
      })();
      const nextIsOrdered = /^\d+\.\s+/.test(nextNonBlankLine);
      const nextIsUnordered = /^[-*]\s+/.test(nextNonBlankLine);

      if (inOrderedList && !nextIsOrdered) {
        processedLines.push('</ol>');
        inOrderedList = false;
      }
      if (inUnorderedList && !nextIsUnordered) {
        processedLines.push('</ul>');
        inUnorderedList = false;
      }

      // Handle empty lines as paragraph breaks — skip consecutive blanks
      // and skip inside an open list (blank lines there are inter-item spacing)
      if (line.trim() === '') {
        if (!lastWasBlank && !inOrderedList && !inUnorderedList) {
          processedLines.push('<br>');
        }
        lastWasBlank = true;
        continue;
      } else if (!line.startsWith('<h') && !line.startsWith('<hr')) {
        lastWasBlank = false;
        processedLines.push(`<p style="margin: 0.75em 0; line-height: 1.6;">${applyInline(line)}</p>`);
      } else {
        lastWasBlank = false;
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
