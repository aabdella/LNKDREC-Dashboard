/**
 * pdfInspector.ts — wrapper around @firecrawl/pdf-inspector for CV processing.
 *
 * Provides classification (text-based vs scanned vs mixed) and structured
 * markdown extraction, replacing the legacy pdf2json-based pipeline.
 */

import {
  classifyPdf,
  extractPagesMarkdown,
  extractText,
  type PdfClassification,
  type PagesExtractionResult,
} from "@firecrawl/pdf-inspector";

// ── Re-export for consumers ──────────────────────────────────────────────────
export type { PdfClassification, PagesExtractionResult };

// ── Consolidated result ──────────────────────────────────────────────────────

export interface PdfInspectionResult {
  /** Classification: "text_based" | "scanned" | "image_based" | "mixed" */
  pdfType: string;
  /** Confidence score 0.0–1.0 */
  confidence: number;
  /** Total page count */
  pageCount: number;
  /** 1-indexed pages that need OCR */
  pagesNeedingOcr: number[];
  /** Per-page OCR reasons when available */
  ocrReasonsByPage: Array<{ page: number; reasons: string[] }>;
  /** Structured markdown (full document) */
  markdown: string | null;
  /** Plain text fallback (always available) */
  text: string;
  /** 1-indexed pages with detected tables */
  pagesWithTables: number[];
  /** 1-indexed pages with multi-column layout */
  pagesWithColumns: number[];
  /** True when at least one page needs OCR (scanned/mixed) */
  hasScannedPages: boolean;
  /** True when the PDF is entirely scanned/image-based */
  isFullyScanned: boolean;
}

// ── Process a PDF buffer ─────────────────────────────────────────────────────

export function inspectPdf(buffer: Buffer): PdfInspectionResult {
  // Step 1: Classify (lightweight, ~10-50ms)
  const classification: PdfClassification = classifyPdf(buffer);

  const pdfType = String(classification.pdfType || "Unknown");
  const confidence = classification.confidence ?? 0;
  const pageCount = classification.pageCount ?? 0;
  const pagesNeedingOcr: number[] = classification.pagesNeedingOcr ?? [];

  const isFullyScanned =
    pdfType === "Scanned" || pdfType === "ImageBased";
  const hasScannedPages = pagesNeedingOcr.length > 0;

  // Step 2: Extract structured markdown
  let markdown: string | null = null;
  let pagesWithTables: number[] = [];
  let pagesWithColumns: number[] = [];
  let ocrReasonsByPage: Array<{ page: number; reasons: string[] }> = [];

  try {
    const extraction: PagesExtractionResult = extractPagesMarkdown(buffer);
    markdown = extraction.pages.map((p) => p.markdown).join("\n\n");
    pagesWithTables = extraction.pagesWithTables ?? [];
    pagesWithColumns = extraction.pagesWithColumns ?? [];
    ocrReasonsByPage = extraction.ocrReasonsByPage ?? [];
  } catch {
    // Fall back to plain text if markdown extraction fails
  }

  // Step 3: Plain text (always available as fallback)
  let text = "";
  try {
    text = extractText(buffer);
  } catch {
    text = markdown ?? "";
  }

  return {
    pdfType,
    confidence,
    pageCount,
    pagesNeedingOcr,
    ocrReasonsByPage,
    markdown,
    text,
    pagesWithTables,
    pagesWithColumns,
    hasScannedPages,
    isFullyScanned,
  };
}
