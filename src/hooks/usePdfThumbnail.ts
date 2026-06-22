import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

interface ThumbnailResult {
  dataUrl: string | null;
  pageCount: number;
  loading: boolean;
  error: string | null;
}

const cache = new Map<string, { dataUrl: string; pageCount: number }>();

export function usePdfThumbnail(fileUrl: string | undefined, scale = 0.3): ThumbnailResult {
  const [result, setResult] = useState<ThumbnailResult>({ dataUrl: null, pageCount: 0, loading: true, error: null });

  useEffect(() => {
    if (!fileUrl || fileUrl === '[local]') {
      setResult({ dataUrl: null, pageCount: 0, loading: false, error: null });
      return;
    }

    const cacheKey = `${fileUrl}:${scale}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!;
      setResult({ ...cached, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setResult({ dataUrl: null, pageCount: 0, loading: true, error: null });

    (async () => {
      try {
        // Only handle PDFs and data URLs for PDFs
        const isPdf = fileUrl.includes('application/pdf') || fileUrl.toLowerCase().endsWith('.pdf') ||
          (fileUrl.startsWith('data:') && fileUrl.includes('application/pdf'));
        const isImage = /\.(png|jpg|jpeg|webp|gif)$/i.test(fileUrl) ||
          (fileUrl.startsWith('data:image/'));

        if (isImage) {
          if (!cancelled) setResult({ dataUrl: fileUrl, pageCount: 1, loading: false, error: null });
          return;
        }

        if (!isPdf) {
          if (!cancelled) setResult({ dataUrl: null, pageCount: 0, loading: false, error: null });
          return;
        }

        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdfDoc = await loadingTask.promise;
        const pageCount = pdfDoc.numPages;
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;

        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        if (!cancelled) {
          cache.set(cacheKey, { dataUrl, pageCount });
          setResult({ dataUrl, pageCount, loading: false, error: null });
        }
      } catch (err: any) {
        if (!cancelled) setResult({ dataUrl: null, pageCount: 0, loading: false, error: err.message });
      }
    })();

    return () => { cancelled = true; };
  }, [fileUrl, scale]);

  return result;
}

// Render a specific page to a canvas element
export async function renderPdfPage(
  fileUrl: string,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.5
): Promise<number> {
  const loadingTask = pdfjsLib.getDocument(fileUrl);
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return pdfDoc.numPages;
}
