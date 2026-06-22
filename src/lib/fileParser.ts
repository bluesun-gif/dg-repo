import * as pdfjsLib from 'pdfjs-dist';

// Stable CDN worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ─── Lazy-load Mammoth from CDN ───
async function loadMammoth(): Promise<any> {
  if ((window as any).mammoth) return (window as any).mammoth;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js';
    script.onload = () => {
      if ((window as any).mammoth) resolve((window as any).mammoth);
      else reject(new Error('Mammoth failed to initialize'));
    };
    script.onerror = () => reject(new Error('Failed to load Mammoth CDN'));
    document.head.appendChild(script);
  });
}

// ─── Lazy-load Tesseract.js from CDN (for image OCR) ───
async function loadTesseract(): Promise<any> {
  if ((window as any).Tesseract) return (window as any).Tesseract;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = () => {
      if ((window as any).Tesseract) resolve((window as any).Tesseract);
      else reject(new Error('Tesseract failed to initialize'));
    };
    script.onerror = () => reject(new Error('Failed to load Tesseract CDN'));
    document.head.appendChild(script);
  });
}

// ─── PDF text extraction ───
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let fullText = '';
  const numPages = Math.min(pdf.numPages, 25);
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n\n';
  }

  if (!fullText.trim()) {
    throw new Error('PDF appears to be image-only (scanned). Text extraction returned empty.');
  }
  return fullText;
}

// ─── DOCX text extraction ───
async function extractTextFromDOCX(file: File): Promise<string> {
  const mammothLib = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammothLib.extractRawText({ arrayBuffer });
  return result.value;
}

// ─── Image OCR using Tesseract.js ───
async function extractTextFromImage(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  onProgress?.('Loading OCR engine...');
  const Tesseract = await loadTesseract();
  onProgress?.('Running OCR on image...');
  
  const result = await Tesseract.recognize(file, 'eng', {
    logger: (m: any) => {
      if (m.status === 'recognizing text') {
        onProgress?.(`OCR: ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  return result.data.text;
}

// ─── HTML extraction from DOCX (for preview rendering) ───
export async function extractHtmlFromDOCX(file: File): Promise<string> {
  try {
    const mammothLib = await loadMammoth();
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammothLib.convertToHtml({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.warn('DOCX→HTML conversion failed:', error);
    return '';
  }
}

// ─── Main entry: auto-detects file type and extracts text ───
export async function extractTextFromFile(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'pdf') {
    onProgress?.('Extracting text from PDF...');
    return await extractTextFromPDF(file);
  }

  if (ext === 'docx' || ext === 'doc') {
    onProgress?.('Extracting text from Word document...');
    return await extractTextFromDOCX(file);
  }

  if (ext === 'txt' || ext === 'md' || ext === 'csv') {
    onProgress?.('Reading text file...');
    return await file.text();
  }

  // Image types → OCR
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'gif'].includes(ext || '')) {
    return await extractTextFromImage(file, onProgress);
  }

  throw new Error(`Unsupported file type ".${ext}". Supported: PDF, DOCX, TXT, CSV, PNG, JPG, JPEG`);
}
