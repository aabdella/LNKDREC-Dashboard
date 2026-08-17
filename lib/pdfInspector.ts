/**
 * pdfInspector.ts — CV PDF processing with graceful fallback.
 *
 * Primary: @firecrawl/pdf-inspector (classification + structured markdown).
 * Fallback: pdf2json (raw text extraction) when native binding is unavailable
 * (e.g. Vercel serverless).
 *
 * The expanded taxonomies and LLM enrichment work regardless of backend.
 */

// ── Result shape (same regardless of backend) ────────────────────────────────

export interface PdfInspectionResult {
  pdfType: string;
  confidence: number;
  pageCount: number;
  pagesNeedingOcr: number[];
  ocrReasonsByPage: Array<{ page: number; reasons: string[] }>;
  markdown: string | null;
  text: string;
  pagesWithTables: number[];
  pagesWithColumns: number[];
  hasScannedPages: boolean;
  isFullyScanned: boolean;
  /** Which backend produced this result */
  backend: "pdf-inspector" | "pdf2json";
}

export function emptyResult(text = ""): PdfInspectionResult {
  return {
    pdfType: "Unknown",
    confidence: 0,
    pageCount: 1,
    pagesNeedingOcr: [],
    ocrReasonsByPage: [],
    markdown: null,
    text,
    pagesWithTables: [],
    pagesWithColumns: [],
    hasScannedPages: false,
    isFullyScanned: false,
    backend: "pdf2json",
  };
}

// ── Try pdf-inspector, fall back to pdf2json ─────────────────────────────────

let _backend: "pdf-inspector" | "pdf2json" | null = null;

async function getBackend(): Promise<"pdf-inspector" | "pdf2json"> {
  if (_backend !== null) return _backend;
  try {
    // Dynamic import — native module may not exist on this platform
    await import("@firecrawl/pdf-inspector");
    _backend = "pdf-inspector";
  } catch {
    _backend = "pdf2json";
  }
  return _backend;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function inspectPdf(buffer: Buffer): Promise<PdfInspectionResult> {
  const backend = await getBackend();

  if (backend === "pdf-inspector") {
    return inspectWithPdfInspector(buffer);
  }
  return inspectWithPdf2Json(buffer);
}

// ── pdf-inspector path ───────────────────────────────────────────────────────

async function inspectWithPdfInspector(buffer: Buffer): Promise<PdfInspectionResult> {
  const { classifyPdf, extractPagesMarkdown, extractText } =
    await import("@firecrawl/pdf-inspector");

  const classification = classifyPdf(buffer);
  const pdfType = String(classification.pdfType || "Unknown");
  const confidence = classification.confidence ?? 0;
  const pageCount = classification.pageCount ?? 0;
  const pagesNeedingOcr: number[] = classification.pagesNeedingOcr ?? [];

  let markdown: string | null = null;
  let pagesWithTables: number[] = [];
  let pagesWithColumns: number[] = [];
  let ocrReasonsByPage: Array<{ page: number; reasons: string[] }> = [];

  try {
    const extraction = extractPagesMarkdown(buffer);
    markdown = extraction.pages.map((p) => p.markdown).join("\n\n");
    pagesWithTables = extraction.pagesWithTables ?? [];
    pagesWithColumns = extraction.pagesWithColumns ?? [];
    ocrReasonsByPage = extraction.ocrReasonsByPage ?? [];
  } catch {
    // markdown extraction failed — text fallback below
  }

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
    hasScannedPages: pagesNeedingOcr.length > 0,
    isFullyScanned: pdfType === "Scanned" || pdfType === "ImageBased",
    backend: "pdf-inspector",
  };
}

// ── pdf2json fallback path ───────────────────────────────────────────────────

async function inspectWithPdf2Json(buffer: Buffer): Promise<PdfInspectionResult> {
  // pdf2json is already in package.json — no new dependency
  const PDFParser = (await import("pdf2json")).default;

  return new Promise((resolve) => {
    const parser = new PDFParser();

    parser.on("pdfParser_dataReady", (data: any) => {
      const lines: string[] = [];
      const pages = data?.Pages ?? [];
      for (const page of pages) {
        for (const text of page?.Texts ?? []) {
          const decoded = decodeURIComponent(text.R?.[0]?.T ?? "");
          if (decoded.trim()) lines.push(decoded);
        }
      }
      const text = lines.join(" ").replace(/\s+/g, " ").trim();

      // pdf2json can't classify — best-effort: if text is < 50 chars, likely scanned
      const isScanned = text.length < 50;
      resolve({
        ...emptyResult(text),
        pageCount: pages.length || 1,
        pdfType: isScanned ? "ImageBased" : "TextBased",
        hasScannedPages: isScanned,
        isFullyScanned: isScanned,
      });
    });

    parser.on("pdfParser_dataError", () => {
      resolve(emptyResult());
    });

    parser.parseBuffer(buffer);
  });
}
