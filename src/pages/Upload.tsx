import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  UploadCloud, X, Plus, CheckCircle2, Loader2, AlertCircle,
  FileText, FileImage, FileSpreadsheet, FileType, Tag, ChevronDown,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { extractTextFromFile, extractHtmlFromDOCX } from '@/lib/fileParser';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { db, storage } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { invalidateSearchIndex } from '@/components/GlobalSearch';

// ─── Persistent option lists (stored in localStorage) ───
const STORAGE_KEY_OPTS = 'dg_field_options';

interface FieldOptions {
  departments: string[];
  categories: string[];
  products: string[];
  correspondents: string[];
}

const DEFAULT_OPTS: FieldOptions = {
  departments: ['Sales', 'Technical', 'Finance', 'Legal', 'HR', 'Operations', 'Other'],
  categories: ['Technical Proposal', 'Financial Proposal', 'Contract', 'RFP', 'Architecture', 'Report', 'Invoice', 'Other'],
  products: ['Web Portal', 'Mobile App', 'Cloud Hosting', 'Security Audit', 'OneID SSO', 'Custom Development'],
  correspondents: [],
};

function loadOptions(): FieldOptions {
  try {
    const s = localStorage.getItem(STORAGE_KEY_OPTS);
    return s ? { ...DEFAULT_OPTS, ...JSON.parse(s) } : DEFAULT_OPTS;
  } catch { return DEFAULT_OPTS; }
}

function saveOptions(opts: FieldOptions) {
  localStorage.setItem(STORAGE_KEY_OPTS, JSON.stringify(opts));
}

function addOption(field: keyof FieldOptions, value: string) {
  const opts = loadOptions();
  const trimmed = value.trim();
  if (trimmed && !opts[field].includes(trimmed)) {
    opts[field] = [...opts[field], trimmed];
    saveOptions(opts);
  }
}

// ─── Pipeline ───
type StepStatus = 'idle' | 'active' | 'done' | 'error' | 'skipped';
interface PipelineStep { label: string; status: StepStatus; detail?: string; }

// ─── Helpers ───
const fileToDataURL = (file: File): Promise<string> =>
  new Promise((res, rej) => { const r = new FileReader(); r.readAsDataURL(file); r.onload = () => res(r.result as string); r.onerror = rej; });

const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(2)} MB`;

const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return FileImage;
  if (['csv', 'xlsx', 'xls'].includes(ext)) return FileSpreadsheet;
  if (ext === 'pdf') return FileType;
  return FileText;
};

// ─── Free-text Combobox ─────────────────────────────────────────────────────
// Allows user to type freely OR pick from existing options.
// New typed values are saved to localStorage for future use.
interface ComboboxProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  field: keyof FieldOptions;
  onOptionsChange: () => void;
  required?: boolean;
}

function Combobox({ value, onChange, options, placeholder = 'Type or select...', field, onOptionsChange, required }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const filtered = options.filter(o => o.toLowerCase().includes(inputVal.toLowerCase()));

  useEffect(() => { setInputVal(value); }, [value]);

  const commit = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setInputVal(trimmed);
    addOption(field, trimmed);
    onOptionsChange();
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center h-9 bg-muted/40 border border-border rounded-md px-3 gap-1 focus-within:ring-2 focus-within:ring-primary/40 transition-all">
        <input
          value={inputVal}
          onChange={e => { setInputVal(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setTimeout(() => {
              setOpen(false);
              const trimmed = inputVal.trim();
              if (trimmed) {
                commit(trimmed);
              }
            }, 180);
          }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(inputVal); } if (e.key === 'Escape') setOpen(false); }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <ChevronDown size={13} className={`text-muted-foreground transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }} />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto py-1">
          {filtered.length === 0 && inputVal && (
            <button onMouseDown={() => commit(inputVal)}
              className="w-full text-left px-3 py-2 text-xs text-primary hover:bg-muted/60 transition-colors flex items-center gap-1.5">
              <Plus size={11} /> Add "{inputVal}" as new option
            </button>
          )}
          {filtered.map(opt => (
            <button key={opt} onMouseDown={() => commit(opt)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-muted/60 ${value === opt ? 'text-primary font-medium' : 'text-foreground'}`}>
              {opt}
            </button>
          ))}
          {inputVal && !options.includes(inputVal) && filtered.length > 0 && (
            <div className="border-t border-border mt-1 pt-1">
              <button onMouseDown={() => commit(inputVal)}
                className="w-full text-left px-3 py-2 text-xs text-primary hover:bg-muted/60 flex items-center gap-1.5">
                <Plus size={11} /> Save "{inputVal}" as new option
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Multi-product combobox row ─────────────────────────────────────────────
function ProductRow({ value, onChange, onRemove, options, onOptionsChange, canRemove }: {
  value: string; onChange: (v: string) => void; onRemove: () => void;
  options: string[]; onOptionsChange: () => void; canRemove: boolean; key?: React.Key;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Combobox value={value} onChange={onChange} options={options} placeholder="Type product name..." field="products" onOptionsChange={onOptionsChange} />
      </div>
      {canRemove && (
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0">
          <X size={15} />
        </button>
      )}
    </div>
  );
}

// ─── Step indicator ──────────────────────────────────────────────────────────
function Step({ label, status, detail }: PipelineStep) {
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0 w-6 h-6 flex items-center justify-center">
        {status === 'idle' && <div className="w-4 h-4 rounded-full border-2 border-border" />}
        {status === 'active' && <Loader2 size={16} className="text-primary animate-spin" />}
        {status === 'done' && <CheckCircle2 size={16} className="text-emerald-400" />}
        {status === 'error' && <AlertCircle size={16} className="text-amber-400" />}
        {status === 'skipped' && <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />}
      </div>
      <div>
        <p className={`text-xs font-medium ${
          status === 'active' ? 'text-primary' : status === 'done' ? 'text-emerald-400' :
          status === 'error' ? 'text-amber-400' : 'text-muted-foreground'
        }`}>{label}</p>
        {detail && <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Upload() {
  const { currentUser, userProfile } = useAuth();

  const [opts, setOpts] = useState<FieldOptions>(loadOptions);
  const reloadOpts = () => setOpts(loadOptions());

  const [file, setFile] = useState<File | null>(null);
  const [dept, setDept] = useState('');
  const [client, setClient] = useState('');
  const [category, setCategory] = useState('');
  const [version, setVersion] = useState('1');
  const [products, setProducts] = useState<string[]>(['']);
  const [confidentiality, setConfidentiality] = useState('Internal');
  const [customTag, setCustomTag] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadTaskRef = useRef<ReturnType<typeof uploadBytesResumable> | null>(null);

  const [steps, setSteps] = useState<PipelineStep[]>([
    { label: 'Select file', status: 'idle' },
    { label: 'Extract text / OCR', status: 'idle' },
    { label: 'Save to repository', status: 'idle' },
  ]);

  const updateStep = (idx: number, status: StepStatus, detail?: string) =>
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status, detail } : s));

  const resetSteps = () => setSteps([
    { label: 'Select file', status: 'idle' },
    { label: 'Extract text / OCR', status: 'idle' },
    { label: 'Save to repository', status: 'idle' },
  ]);

  // ── Dropzone ──
  const onDrop = useCallback(async (accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    setFile(f);
    updateStep(0, 'done', f.name);
    // Auto-run OCR immediately after file select
    runOCR(f);
  }, []);

  // @ts-expect-error react-dropzone + react 19 type conflict
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    maxSize: 50 * 1024 * 1024,
    onDropRejected: (r) => toast.error(r[0]?.errors[0]?.message || 'File rejected'),
  });

  // ── Auto OCR on file select ──
  const runOCR = async (f: File) => {
    updateStep(1, 'active', 'Extracting text...');
    try {
      const text = await extractTextFromFile(f, (msg) => updateStep(1, 'active', msg));
      const preview = text.substring(0, 80).trim();
      updateStep(1, 'done', preview ? `"${preview}…"` : 'Text extracted');
      // Auto-populate tags from common words in the text (simple keyword extraction)
      autoExtractTags(text);
      // Auto-fill metadata based on text and file name
      autoFillMetadata(text, f.name);
    } catch (err: any) {
      updateStep(1, 'error', `OCR skipped: ${err.message?.slice(0, 50) || 'Could not extract text'}`);
      // Try to fill metadata even if OCR failed (using filename only)
      autoFillMetadata('', f.name);
    }
  };

  // Simple keyword-based tag suggestion from OCR text
  const autoExtractTags = (text: string) => {
    const keywords = [
      'invoice', 'contract', 'proposal', 'report', 'agreement',
      'quotation', 'purchase', 'order', 'payment', 'receipt',
      'nid', 'tax', 'vat', 'nbr', 'bangladesh', 'tender',
    ];
    const lowerText = text.toLowerCase();
    const found = keywords.filter(k => lowerText.includes(k));
    if (found.length > 0) {
      setTags(prev => [...new Set([...prev, ...found])]);
    }
  };

  // Heuristic-based metadata auto-completion to minimize uploader effort
  const autoFillMetadata = (text: string, filename: string) => {
    const combined = (filename + ' ' + text).toLowerCase();

    // 1. Guess Department
    let guessedDept = '';
    if (combined.includes('sale') || combined.includes('marketing') || combined.includes('pitch') || combined.includes('proposal')) guessedDept = 'Sales';
    else if (combined.includes('tech') || combined.includes('code') || combined.includes('software') || combined.includes('architect') || combined.includes('develop')) guessedDept = 'Technical';
    else if (combined.includes('billing') || combined.includes('invoice') || combined.includes('finance') || combined.includes('payment') || combined.includes('tax') || combined.includes('vat')) guessedDept = 'Finance';
    else if (combined.includes('legal') || combined.includes('contract') || combined.includes('agreement') || combined.includes('nda')) guessedDept = 'Legal';
    else if (combined.includes('hr') || combined.includes('recruitment') || combined.includes('employee') || combined.includes('salary')) guessedDept = 'HR';
    else if (combined.includes('operation') || combined.includes('logistics') || combined.includes('support')) guessedDept = 'Operations';

    if (guessedDept && !dept) setDept(guessedDept);

    // 2. Guess Document Type / Category
    let guessedCat = '';
    if (combined.includes('technical proposal') || (combined.includes('technical') && combined.includes('proposal'))) guessedCat = 'Technical Proposal';
    else if (combined.includes('financial proposal') || (combined.includes('financial') && combined.includes('proposal')) || combined.includes('quotation') || combined.includes('pricing')) guessedCat = 'Financial Proposal';
    else if (combined.includes('contract') || combined.includes('agreement') || combined.includes('nda') || combined.includes('signing')) guessedCat = 'Contract';
    else if (combined.includes('rfp') || combined.includes('request for proposal')) guessedCat = 'RFP';
    else if (combined.includes('architecture') || combined.includes('design') || combined.includes('blueprint')) guessedCat = 'Architecture';
    else if (combined.includes('report') || combined.includes('audit') || combined.includes('analysis')) guessedCat = 'Report';
    else if (combined.includes('invoice') || combined.includes('bill') || combined.includes('receipt')) guessedCat = 'Invoice';

    if (guessedCat && !category) setCategory(guessedCat);

    // 3. Guess Client / Correspondent Name
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    const parts = nameWithoutExt.split(/[\s_.-]+/).filter(p => {
      const lp = p.toLowerCase();
      return lp.length > 2 && 
        !['invoice', 'proposal', 'contract', 'report', 'draft', 'final', 'version', 'dept', 'client', 'document', 'file', 'upload', 'pdf', 'docx', 'xlsx', 'txt', 'png', 'jpg', 'jpeg'].includes(lp);
    });
    if (parts.length > 0 && !client) {
      const guessed = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      setClient(guessed);
    }

    // 4. Guess Products
    const guessedProds: string[] = [];
    if (combined.includes('portal') || combined.includes('website') || combined.includes('web app')) guessedProds.push('Web Portal');
    if (combined.includes('mobile') || combined.includes('ios') || combined.includes('android') || combined.includes('app ')) guessedProds.push('Mobile App');
    if (combined.includes('cloud') || combined.includes('hosting') || combined.includes('aws') || combined.includes('azure')) guessedProds.push('Cloud Hosting');
    if (combined.includes('security') || combined.includes('audit') || combined.includes('penetration')) guessedProds.push('Security Audit');
    if (combined.includes('sso') || combined.includes('single sign') || combined.includes('oneid') || combined.includes('identity')) guessedProds.push('OneID SSO');
    if (combined.includes('custom') || combined.includes('development') || combined.includes('software')) guessedProds.push('Custom Development');

    if (guessedProds.length > 0) {
      setProducts(guessedProds);
    }
  };

  // ── Upload ──
  const handleUpload = async () => {
    if (!file) { toast.error('Please select a file first'); return; }
    if (!dept) { toast.error('Please enter a Department'); return; }
    if (!client) { toast.error('Please enter a Correspondent / Client name'); return; }
    if (!category) { toast.error('Please enter a Document Type'); return; }

    // Save any new custom values to the persistent lists
    addOption('departments', dept);
    addOption('categories', category);
    addOption('correspondents', client);
    products.filter(Boolean).forEach(p => addOption('products', p));
    reloadOpts();

    setIsUploading(true);
    updateStep(2, 'active', 'Preparing...');

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const safeDept = dept.replace(/\s+/g, '-').toUpperCase().slice(0, 4);
      const safeClient = client.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().slice(0, 10);
      const safeCat = category.replace(/\s+/g, '-').slice(0, 12);
      const dateStr = new Date().toISOString().slice(0, 10);
      const generatedName = `${safeDept}_${safeClient}_${safeCat}_${dateStr}_v${version}.${ext}`;

      const uid = currentUser?.uid || 'anon';
      const email = currentUser?.email || 'anonymous@dgrepo.com';
      const permissions: Record<string, string> = { [uid]: 'owner' };

      // 1. Firebase Storage — resumable upload with real progress (no timeout)
      let fileUrl = '';
      updateStep(2, 'active', 'Uploading file...');
      try {
        const storageRef = ref(storage, `documents/${uid}/${Date.now()}_${generatedName}`);
        fileUrl = await new Promise<string>((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, file);
          uploadTaskRef.current = task;
          task.on(
            'state_changed',
            (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              setUploadProgress(pct);
              updateStep(2, 'active', `Uploading... ${pct}%`);
            },
            (err) => reject(err),
            async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              resolve(url);
            }
          );
        });
        setUploadProgress(100);
        updateStep(2, 'active', 'File uploaded to cloud ✓');
      } catch (storageErr: any) {
        console.warn('Storage upload failed:', storageErr?.code, storageErr?.message);
        if (file.size <= 4 * 1024 * 1024) {
          updateStep(2, 'active', 'Embedding file locally...');
          fileUrl = await fileToDataURL(file);
        }
      }

      // 2. DOCX HTML
      let htmlContent = '';
      if (ext === 'docx' || ext === 'doc') {
        try { htmlContent = await extractHtmlFromDOCX(file); } catch {}
      }

      // 3. Extract text (capped at 8KB for Firestore)
      let docText = '';
      try { const raw = await extractTextFromFile(file); docText = raw.slice(0, 8000); } catch {}

      const isDataUrl = fileUrl.startsWith('data:');
      const firestoreData = {
        name: generatedName,
        originalName: file.name,
        dept,
        client,
        category,
        version,
        confidentiality,
        products: products.filter(Boolean),
        tags,
        notes,
        text: docText,
        size: formatBytes(file.size),
        sizeBytesRaw: file.size,
        date: dateStr,
        createdAt: new Date().toISOString(),
        uploadedBy: email,
        uploadedByName: userProfile?.name || email,
        ownerId: uid,
        permissions,
        fileUrl: isDataUrl ? '[local]' : fileUrl,
        htmlContent: htmlContent.slice(0, 5000),
        isDeleted: false,
        storageType: isDataUrl ? 'local' : fileUrl ? 'firebase' : 'metadata-only',
      };

      const localRecord = { ...firestoreData, fileUrl, htmlContent };

      // 4. Firestore
      updateStep(2, 'active', 'Saving to Firestore...');
      let firestoreId: string | null = null;
      try {
        const docRef = await addDoc(collection(db, 'documents'), firestoreData);
        firestoreId = docRef.id;
      } catch (e: any) {
        console.warn('Firestore save failed:', e.message);
      }

      // 5. localStorage
      try {
        const localDocs = JSON.parse(localStorage.getItem('local_documents') || '[]');
        const id = firestoreId || `local_${Date.now()}`;
        const filtered = localDocs.filter((d: any) => d.id !== id);
        filtered.unshift({ ...localRecord, id });
        localStorage.setItem('local_documents', JSON.stringify(filtered.slice(0, 200)));
      } catch {}

      // Bust the search index so next search picks up this new document
      invalidateSearchIndex();

      const savedWhere = firestoreId ? '☁ Saved to Firestore' : '💾 Saved locally';
      updateStep(2, 'done', savedWhere);
      toast.success(`✅ "${file.name}" uploaded successfully!`);

      setTimeout(() => {
        setFile(null); setDept(''); setClient(''); setCategory(''); setVersion('1');
        setProducts(['']); setConfidentiality('Internal'); setTags([]); setNotes(''); setCustomTag('');
        resetSteps();
        setIsUploading(false);
      }, 2500);

    } catch (err: any) {
      updateStep(2, 'error', err.message || 'Unknown error');
      toast.error(`Upload failed: ${err.message || 'Please try again'}`);
      setIsUploading(false);
    }
  };

  const addTag = () => {
    const t = customTag.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setCustomTag('');
  };
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));
  const addProduct = () => setProducts(prev => [...prev, '']);
  const updateProduct = (i: number, v: string) => setProducts(prev => prev.map((p, j) => j === i ? v : p));
  const removeProduct = (i: number) => setProducts(prev => prev.filter((_, j) => j !== i));

  const FileIcon = file ? getFileIcon(file.name) : UploadCloud;
  const CONFIDENTIALITIES = ['Public', 'Internal', 'Confidential', 'Restricted'];

  return (
    <div className="min-h-full p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Upload Document</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add a document to your repository. Text is extracted automatically — fill in the metadata below.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── Left column ─── */}
          <div className="lg:col-span-1 space-y-4">
            {/* Drop zone */}
            {!file ? (
              <div {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60 hover:bg-muted/20'
                }`}>
                <input {...getInputProps()} />
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <UploadCloud size={26} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">
                  {isDragActive ? 'Drop it here!' : 'Drag & drop your file'}
                </p>
                <p className="text-xs text-muted-foreground mb-3">or click to browse</p>
                <div className="flex flex-wrap justify-center gap-1.5 text-[10px] text-muted-foreground">
                  {['PDF', 'DOCX', 'TXT', 'CSV', 'PNG', 'JPG', 'WEBP'].map(t => (
                    <span key={t} className="px-2 py-0.5 bg-muted rounded border border-border/60">{t}</span>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Max 50MB</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl p-4 bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileIcon size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                  </div>
                  <button onClick={() => { setFile(null); resetSteps(); }}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <X size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* Pipeline — no AI step */}
            <div className="border border-border rounded-xl p-4 bg-card">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Processing Pipeline</p>
              <div className="space-y-3">
                {steps.map((s, i) => <Step key={i} {...s} />)}
              </div>
              {/* Upload progress bar */}
              {isUploading && uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground">Uploading to cloud…</span>
                    <span className="text-[11px] font-medium text-primary">{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <button
                    onClick={() => { uploadTaskRef.current?.cancel(); setIsUploading(false); }}
                    className="mt-2 text-[10px] text-destructive hover:underline"
                  >
                    Cancel upload
                  </button>
                </div>
              )}
            </div>

            {/* Uploader info */}
            <div className="border border-border rounded-xl p-4 bg-card">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Uploaded By</p>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {(userProfile?.name || currentUser?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{userProfile?.name || currentUser?.email}</p>
                  {userProfile?.employeeId && (
                    <p className="text-[10px] text-muted-foreground">{userProfile.employeeId} · {userProfile.department}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Tip box */}
            <div className="border border-primary/20 rounded-xl p-4 bg-primary/5">
              <p className="text-xs font-semibold text-primary mb-1.5">💡 Flexible fields</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                All dropdowns accept new values — just type and press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> or click "+ Save". New values are remembered for next time.
              </p>
            </div>
          </div>

          {/* ─── Right column: Metadata Form ─── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Basic metadata */}
            <div className="border border-border rounded-xl p-5 bg-card space-y-4">
              <p className="text-sm font-semibold text-foreground border-b border-border pb-2">Document Metadata</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Department — editable */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    Department <span className="text-destructive">*</span>
                    <span className="ml-auto text-[9px] text-primary/60 flex items-center gap-0.5"><Pencil size={8} /> editable</span>
                  </Label>
                  <Combobox value={dept} onChange={setDept} options={opts.departments}
                    placeholder="Type or select dept..." field="departments" onOptionsChange={reloadOpts} required />
                </div>

                {/* Document Type — editable */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    Document Type <span className="text-destructive">*</span>
                    <span className="ml-auto text-[9px] text-primary/60 flex items-center gap-0.5"><Pencil size={8} /> editable</span>
                  </Label>
                  <Combobox value={category} onChange={setCategory} options={opts.categories}
                    placeholder="Type or select type..." field="categories" onOptionsChange={reloadOpts} required />
                </div>

                {/* Correspondent — editable */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    Correspondent / Client <span className="text-destructive">*</span>
                    <span className="ml-auto text-[9px] text-primary/60 flex items-center gap-0.5"><Pencil size={8} /> editable</span>
                  </Label>
                  <Combobox value={client} onChange={setClient} options={opts.correspondents}
                    placeholder="Type client name..." field="correspondents" onOptionsChange={reloadOpts} required />
                </div>

                {/* Confidentiality — fixed (Public/Internal/Confidential/Restricted) */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Confidentiality</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {CONFIDENTIALITIES.map(c => (
                      <button key={c} onClick={() => setConfidentiality(c)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          confidentiality === c
                            ? 'bg-primary text-white border-primary'
                            : 'border-border text-muted-foreground hover:border-primary/50'
                        }`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Version */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Version</Label>
                  <Input value={version} onChange={e => setVersion(e.target.value)}
                    placeholder="1" className="h-9 text-sm bg-muted/40 border-border" />
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Document Date</Label>
                  <Input type="date" className="h-9 text-sm bg-muted/40 border-border"
                    defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Notes / Description</Label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Add any notes or description about this document..."
                  rows={2}
                  className="w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
            </div>

            {/* Products — fully free-text with memory */}
            <div className="border border-border rounded-xl p-5 bg-card space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <p className="text-sm font-semibold text-foreground">Products / Services</p>
                <span className="text-[10px] text-primary/60 flex items-center gap-1"><Pencil size={9} /> type new product names freely</span>
              </div>
              {products.map((p, i) => (
                <ProductRow key={i} value={p} onChange={v => updateProduct(i, v)}
                  onRemove={() => removeProduct(i)} options={opts.products}
                  onOptionsChange={reloadOpts} canRemove={products.length > 1} />
              ))}
              <button onClick={addProduct} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Plus size={13} /> Add another product
              </button>
            </div>

            {/* Tags — OCR auto-suggests + manual input */}
            <div className="border border-border rounded-xl p-5 bg-card space-y-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Tag size={14} className="text-primary" />
                <p className="text-sm font-semibold text-foreground">Tags</p>
                <span className="text-[10px] text-muted-foreground">(auto-suggested from OCR + add manually)</span>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-primary/15 text-primary border border-primary/30 rounded-full text-xs font-medium">
                      #{tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-destructive transition-colors"><X size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input value={customTag} onChange={e => setCustomTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Type tag and press Enter..."
                  className="h-8 text-xs bg-muted/40 border-border" />
                <button onClick={addTag} className="px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded text-xs hover:bg-primary/30 transition-colors whitespace-nowrap">
                  Add
                </button>
              </div>
            </div>

            {/* Submit */}
            <button onClick={handleUpload}
              disabled={!file || isUploading || !dept || !client || !category}
              className="w-full py-3 px-6 bg-primary text-white font-semibold rounded-xl text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
              {isUploading ? (
                <><Loader2 size={16} className="animate-spin" /> Processing...</>
              ) : steps[2].status === 'done' ? (
                <><CheckCircle2 size={16} /> Uploaded Successfully!</>
              ) : (
                <><UploadCloud size={16} /> Confirm & Upload</>
              )}
            </button>
            {(!dept || !client || !category) && file && (
              <p className="text-[11px] text-amber-400 text-center">
                ⚠ Fill in Department, Correspondent, and Document Type to enable upload
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
