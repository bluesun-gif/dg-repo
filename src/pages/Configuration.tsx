import React, { useState, useRef } from 'react';
import { Settings2, Info, Check, X, Loader2, Upload, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GeneralConfig {
  appTitle: string;
  logoDataUrl?: string;
}

interface OcrConfig {
  outputType: string;
  language: string;
  pages: string;
  mode: string;
  skipArchiveFile: string;
  imageDpi: string;
  clean: string;
  deskew: boolean;
  rotatePages: boolean;
  rotatePagesThreshold: string;
  maxImagePixels: string;
  colorConversionStrategy: string;
  ocrArguments: string;
}

interface BarcodeConfig {
  enableBarcodes: boolean;
  enableTiffSupport: boolean;
  barcodeString: string;
  retainSplitPages: boolean;
  enableAsn: boolean;
  asnPrefix: string;
  upscale: string;
  dpi: string;
  maxPages: string;
  enableTagDetection: boolean;
  tagMapping: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadConfig<T>(key: string, defaults: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {}
  return defaults;
}

function saveConfig<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className="flex items-center gap-2 group">
      <div className={`relative w-9 h-5 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-muted border border-border'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? 'left-4' : 'left-0.5'}`} />
      </div>
      <span className={`text-sm ${value ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
    </button>
  );
}

// ─── Select dropdown ──────────────────────────────────────────────────────────
function SelectInput({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full h-9 px-3 flex items-center justify-between bg-muted/40 border border-border rounded-lg text-sm text-foreground hover:border-primary/50 transition-colors">
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{value || placeholder || 'Select…'}</span>
        <ChevronDown size={13} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden py-1 max-h-52 overflow-y-auto">
            <button type="button" onClick={() => { onChange(''); setOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-muted-foreground hover:bg-muted/60 transition-colors">
              — {placeholder || 'None'} —
            </button>
            {options.map(o => (
              <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${value === o ? 'bg-primary/15 text-primary font-medium' : 'text-foreground hover:bg-muted/60'}`}>
                {value === o && <Check size={11} className="shrink-0" />}
                <span className={value !== o ? 'ml-[15px]' : ''}>{o}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Field Card ───────────────────────────────────────────────────────────────
function FieldCard({ label, tooltip, children }: { label: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {tooltip && (
          <div className="relative group/tip">
            <Info size={12} className="text-muted-foreground cursor-help" />
            <div className="absolute left-0 bottom-full mb-1.5 z-50 hidden group-hover/tip:block w-56 p-2 bg-popover border border-border rounded-lg text-[11px] text-muted-foreground shadow-xl">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── General Settings tab ─────────────────────────────────────────────────────
function GeneralTab() {
  const [config, setConfig] = useState<GeneralConfig>(() => loadConfig('dg_config_general', { appTitle: '', logoDataUrl: '' }));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(config.logoDataUrl || '');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 500_000) { toast.error('Logo must be under 500 KB'); return; }
    setLogoFile(f);
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    const next = { ...config, logoDataUrl: logoPreview };
    saveConfig('dg_config_general', next);
    // Apply title
    if (next.appTitle) document.title = next.appTitle;
    toast.success('General settings saved');
    setSaving(false);
  };

  const handleDiscard = () => {
    const loaded = loadConfig<GeneralConfig>('dg_config_general', { appTitle: '', logoDataUrl: '' });
    setConfig(loaded);
    setLogoPreview(loaded.logoDataUrl || '');
    setLogoFile(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-sm font-medium text-foreground">Application Logo</span>
              <Info size={12} className="text-muted-foreground" title="Upload your company logo (PNG/JPG, max 500KB)" />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 text-xs border border-border rounded-lg text-foreground hover:bg-muted/40 transition-colors">
                Choose File
              </button>
              <span className="text-xs text-muted-foreground flex-1 truncate">
                {logoFile ? logoFile.name : 'No file chosen'}
              </span>
              {logoFile && (
                <button type="button" onClick={() => {
                  const reader = new FileReader();
                  reader.onload = ev => setLogoPreview(ev.target?.result as string);
                  if (logoFile) reader.readAsDataURL(logoFile);
                  toast.success('Logo uploaded');
                }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                  <Upload size={11} /> Upload
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            {logoPreview && (
              <div className="mt-3 flex items-center gap-3">
                <img src={logoPreview} alt="Logo preview" className="h-10 w-auto rounded object-contain bg-muted/20 border border-border p-1" />
                <button type="button" onClick={() => { setLogoPreview(''); setLogoFile(null); }}
                  className="text-xs text-destructive hover:underline flex items-center gap-0.5"><X size={11} /> Remove</button>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-sm font-medium text-foreground">Application Title</span>
              <Info size={12} className="text-muted-foreground" title="Displayed in the browser tab and header" />
            </div>
            <Input value={config.appTitle} onChange={e => setConfig(c => ({ ...c, appTitle: e.target.value }))}
              placeholder="e.g. DG Document Repository"
              className="h-9 text-sm bg-muted/40 border-border" />
            {config.appTitle && (
              <p className="text-[11px] text-muted-foreground mt-1.5">Browser tab will show: <span className="text-foreground font-medium">{config.appTitle}</span></p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleDiscard}
          className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors">
          Discard
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="px-5 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2">
          {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Check size={13} /> Save</>}
        </button>
      </div>
    </div>
  );
}

// ─── OCR Settings tab ─────────────────────────────────────────────────────────
const OCR_DEFAULTS: OcrConfig = {
  outputType: '', language: '', pages: '', mode: '', skipArchiveFile: '',
  imageDpi: '', clean: '', deskew: false, rotatePages: false,
  rotatePagesThreshold: '', maxImagePixels: '', colorConversionStrategy: '', ocrArguments: '',
};

function OcrTab() {
  const [cfg, setCfg] = useState<OcrConfig>(() => loadConfig('dg_config_ocr', OCR_DEFAULTS));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof OcrConfig) => (v: any) => setCfg(c => ({ ...c, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    saveConfig('dg_config_ocr', cfg);
    toast.success('OCR settings saved');
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FieldCard label="Output Type" tooltip="Controls the type of PDF that Tesseract produces.">
          <SelectInput value={cfg.outputType} onChange={set('outputType')} placeholder="Default"
            options={['pdf', 'pdfa', 'pdfa-1', 'pdfa-2', 'pdfa-3', 'txt', 'hocr', 'tsv']} />
        </FieldCard>
        <FieldCard label="Language" tooltip="The language(s) to use for OCR. Separate multiple with +, e.g. eng+ben">
          <Input value={cfg.language} onChange={e => set('language')(e.target.value)}
            placeholder="e.g. eng, ben, eng+ben" className="h-9 text-sm bg-muted/40 border-border" />
        </FieldCard>
        <FieldCard label="Pages" tooltip="Number of pages to process. Leave empty to process all.">
          <Input value={cfg.pages} onChange={e => set('pages')(e.target.value)}
            placeholder="e.g. 1 (leave blank for all)" className="h-9 text-sm bg-muted/40 border-border" />
        </FieldCard>

        <FieldCard label="Mode" tooltip="Controls how OCR is applied.">
          <SelectInput value={cfg.mode} onChange={set('mode')} placeholder="Default"
            options={['skip', 'redo', 'force', 'skip_noarchive']} />
        </FieldCard>
        <FieldCard label="Skip Archive File" tooltip="Control when to skip creating archive files.">
          <SelectInput value={cfg.skipArchiveFile} onChange={set('skipArchiveFile')} placeholder="Default"
            options={['never', 'with_text', 'always']} />
        </FieldCard>
        <FieldCard label="Image DPI" tooltip="Resolution for image to PDF conversion. Default: 300">
          <Input value={cfg.imageDpi} onChange={e => set('imageDpi')(e.target.value)}
            type="number" placeholder="300" className="h-9 text-sm bg-muted/40 border-border" />
        </FieldCard>

        <FieldCard label="Clean" tooltip="Clean pages before OCR using unpaper.">
          <SelectInput value={cfg.clean} onChange={set('clean')} placeholder="Default"
            options={['clean', 'clean-final', 'none']} />
        </FieldCard>
        <FieldCard label="Deskew" tooltip="Correct skewed scanned pages automatically.">
          <Toggle value={cfg.deskew} onChange={set('deskew')} label="Enable" />
        </FieldCard>
        <FieldCard label="Rotate Pages" tooltip="Automatically rotate pages to correct orientation.">
          <Toggle value={cfg.rotatePages} onChange={set('rotatePages')} label="Enable" />
        </FieldCard>

        <FieldCard label="Rotate Pages Threshold" tooltip="Confidence threshold for rotation. Default: 12">
          <Input value={cfg.rotatePagesThreshold} onChange={e => set('rotatePagesThreshold')(e.target.value)}
            type="number" placeholder="12" className="h-9 text-sm bg-muted/40 border-border" />
        </FieldCard>
        <FieldCard label="Max Image Pixels" tooltip="Max pixels for large image processing. Default: 178956970">
          <Input value={cfg.maxImagePixels} onChange={e => set('maxImagePixels')(e.target.value)}
            type="number" placeholder="178956970" className="h-9 text-sm bg-muted/40 border-border" />
        </FieldCard>
        <FieldCard label="Color Conversion Strategy" tooltip="PostScript color conversion for PDF/A.">
          <SelectInput value={cfg.colorConversionStrategy} onChange={set('colorConversionStrategy')} placeholder="Default"
            options={['RGB', 'CMYK', 'Gray', 'useDeviceIndependentColor', 'LeaveColorUnchanged']} />
        </FieldCard>
      </div>

      <FieldCard label="OCR Arguments" tooltip="Additional Tesseract command-line arguments. Advanced use only.">
        <textarea value={cfg.ocrArguments} onChange={e => set('ocrArguments')(e.target.value)}
          rows={3} placeholder="e.g. --oem 1 --psm 3"
          className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary/40" />
      </FieldCard>

      <div className="flex gap-2">
        <button type="button" onClick={() => { setCfg(OCR_DEFAULTS); toast.info('Discarded changes'); }}
          className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors">Discard</button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="px-5 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2">
          {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Check size={13} /> Save</>}
        </button>
      </div>
    </div>
  );
}

// ─── Barcode Settings tab ─────────────────────────────────────────────────────
const BC_DEFAULTS: BarcodeConfig = {
  enableBarcodes: false, enableTiffSupport: false, barcodeString: '',
  retainSplitPages: false, enableAsn: false, asnPrefix: '', upscale: '',
  dpi: '', maxPages: '', enableTagDetection: false, tagMapping: '',
};

function BarcodeTab() {
  const [cfg, setCfg] = useState<BarcodeConfig>(() => loadConfig('dg_config_barcode', BC_DEFAULTS));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof BarcodeConfig) => (v: any) => setCfg(c => ({ ...c, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    saveConfig('dg_config_barcode', cfg);
    toast.success('Barcode settings saved');
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {!cfg.enableBarcodes && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-400/10 border border-amber-400/30 rounded-xl text-xs text-amber-400">
          <Info size={13} /> Enable barcodes to unlock all barcode processing features.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FieldCard label="Enable Barcodes" tooltip="Enable barcode processing for document splitting.">
          <Toggle value={cfg.enableBarcodes} onChange={set('enableBarcodes')} label="Enable" />
        </FieldCard>
        <FieldCard label="Enable TIFF Support" tooltip="Allow TIFF files to be processed for barcodes.">
          <Toggle value={cfg.enableTiffSupport} onChange={v => { if (cfg.enableBarcodes) set('enableTiffSupport')(v); else toast.info('Enable barcodes first'); }} label="Enable" />
        </FieldCard>
        <FieldCard label="Barcode String" tooltip="The barcode value that triggers document splitting.">
          <Input value={cfg.barcodeString} onChange={e => set('barcodeString')(e.target.value)}
            placeholder="e.g. PATCHT" className="h-9 text-sm bg-muted/40 border-border" disabled={!cfg.enableBarcodes} />
        </FieldCard>

        <FieldCard label="Retain Split Pages" tooltip="Keep the barcode page when splitting documents.">
          <Toggle value={cfg.retainSplitPages} onChange={v => { if (cfg.enableBarcodes) set('retainSplitPages')(v); else toast.info('Enable barcodes first'); }} label="Enable" />
        </FieldCard>
        <FieldCard label="Enable ASN" tooltip="Enable Archive Serial Number (ASN) barcode support.">
          <Toggle value={cfg.enableAsn} onChange={v => { if (cfg.enableBarcodes) set('enableAsn')(v); else toast.info('Enable barcodes first'); }} label="Enable" />
        </FieldCard>
        <FieldCard label="ASN Prefix" tooltip="The string prefix for ASN barcodes.">
          <Input value={cfg.asnPrefix} onChange={e => set('asnPrefix')(e.target.value)}
            placeholder="e.g. ASN" className="h-9 text-sm bg-muted/40 border-border" disabled={!cfg.enableAsn} />
        </FieldCard>

        <FieldCard label="Upscale" tooltip="Factor to upscale images before barcode detection. 0 = disabled.">
          <Input value={cfg.upscale} onChange={e => set('upscale')(e.target.value)}
            type="number" placeholder="0" className="h-9 text-sm bg-muted/40 border-border" disabled={!cfg.enableBarcodes} />
        </FieldCard>
        <FieldCard label="DPI" tooltip="DPI resolution for barcode detection. Default: 300">
          <Input value={cfg.dpi} onChange={e => set('dpi')(e.target.value)}
            type="number" placeholder="300" className="h-9 text-sm bg-muted/40 border-border" disabled={!cfg.enableBarcodes} />
        </FieldCard>
        <FieldCard label="Max Pages" tooltip="Maximum pages to scan for barcodes. 0 = all pages.">
          <Input value={cfg.maxPages} onChange={e => set('maxPages')(e.target.value)}
            type="number" placeholder="0" className="h-9 text-sm bg-muted/40 border-border" disabled={!cfg.enableBarcodes} />
        </FieldCard>

        <FieldCard label="Enable Tag Detection" tooltip="Auto-detect tags from barcode content.">
          <Toggle value={cfg.enableTagDetection} onChange={v => { if (cfg.enableBarcodes) set('enableTagDetection')(v); else toast.info('Enable barcodes first'); }} label="Enable" />
        </FieldCard>
        <FieldCard label="Tag Mapping" tooltip="JSON mapping of barcode values to tag names.">
          <Input value={cfg.tagMapping} onChange={e => set('tagMapping')(e.target.value)}
            placeholder='{"INVOICE": "invoice"}' className="h-9 text-sm font-mono bg-muted/40 border-border" disabled={!cfg.enableTagDetection} />
        </FieldCard>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => { setCfg(BC_DEFAULTS); toast.info('Discarded changes'); }}
          className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors">Discard</button>
        <button type="button" onClick={handleSave} disabled={saving || !cfg.enableBarcodes}
          className="px-5 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
          {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Check size={13} /> Save</>}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'general', label: 'General Settings' },
  { id: 'ocr',     label: 'OCR Settings' },
  { id: 'barcode', label: 'Barcode Settings' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function Configuration() {
  const [activeTab, setActiveTab] = useState<TabId>('general');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings2 size={18} className="text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-foreground">Application Configuration</h1>
            <Info size={13} className="text-muted-foreground cursor-help" title="System-wide configuration settings" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-6 pt-4 border-b border-border shrink-0">
        {TABS.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'general' && <GeneralTab />}
        {activeTab === 'ocr' && <OcrTab />}
        {activeTab === 'barcode' && <BarcodeTab />}
      </div>
    </div>
  );
}
