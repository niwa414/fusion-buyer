import type { IngestResult, IngestStatus } from './types';

interface PdfTextFinalizeOptions {
  fileName: string;
  pageTexts: string[];
  warnings?: string[];
}

function normalizeText(value: string) {
  return value.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').trim();
}

function classifyStatus(text: string, pageCount: number): IngestStatus {
  if (pageCount === 0 || text.length === 0) {
    return 'empty_text_layer';
  }

  if (text.length < 80) {
    return 'scanned_or_unsupported';
  }

  return 'ok';
}

export function finalizePdfTextIngest(options: PdfTextFinalizeOptions): IngestResult {
  const normalizedPages = options.pageTexts.map((pageText) => normalizeText(pageText));
  const text = normalizedPages.filter(Boolean).join('\n\n');
  const pageCount = options.pageTexts.length;
  const status = classifyStatus(text, pageCount);
  const warnings = [...(options.warnings ?? [])];

  if (status === 'empty_text_layer') {
    warnings.push('PDF has no extractable text layer. Paste text manually for V1.');
  }

  if (status === 'scanned_or_unsupported') {
    warnings.push('PDF text is too sparse for reliable extraction. Paste text manually for V1.');
  }

  return {
    status,
    text,
    pageCount,
    warnings,
    fileName: options.fileName,
  };
}

export async function ingestPdfBuffer(data: ArrayBuffer, fileName = 'upload.pdf'): Promise<IngestResult> {
  try {
    const { getDocument } = await import('pdfjs-dist/webpack.mjs');
    const pdf = await getDocument({ data: new Uint8Array(data) }).promise;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
        .join(' ')
        .trim();

      pageTexts.push(pageText);
    }

    return finalizePdfTextIngest({
      fileName,
      pageTexts,
    });
  } catch (error) {
    return {
      status: 'parse_error',
      text: '',
      pageCount: 0,
      warnings: [error instanceof Error ? error.message : 'Unknown PDF parse error.'],
      fileName,
    };
  }
}

export async function ingestPdfFile(file: File): Promise<IngestResult> {
  const buffer = await file.arrayBuffer();

  return ingestPdfBuffer(buffer, file.name);
}
