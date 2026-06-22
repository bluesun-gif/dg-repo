import React, {
  useState, useEffect, useRef, useCallback, createContext, useContext,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import {
  Search, FileText, Tag, Users, Folder, X, Clock,
  Loader2, ChevronRight, HardDrive, SlidersHorizontal, Zap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type SearchResultKind =
  | 'document' | 'correspondent' | 'tag' | 'document-type'
  | 'storage-path' | 'custom-field' | 'user' | 'page';

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle?: string;
  meta?: string;
  score: number;
  ocrSnippet?: string;
  route: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface GlobalSearchCtx {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const GlobalSearchContext = createContext<GlobalSearchCtx>({
  open: false, openSearch: () => {}, closeSearch: () => {},
});

export function useGlobalSearch() { return useContext(GlobalSearchContext); }

// ─── Index cache ──────────────────────────────────────────────────────────────
interface SearchIndex {
  documents: any[];
  correspondents: string[];
  tags: string[];
  documentTypes: string[];
  loaded: boolean;
}

let _index: SearchIndex = { documents: [], correspondents: [], tags: [], documentTypes: [], loaded: false };
let _loadPromise: Promise<void> | null = null;

// ─── Public: call this after any document/tag/correspondent save ──────────────
export function invalidateSearchIndex() {
  _index = { documents: [], correspondents: [], tags: [], documentTypes: [], loaded: false };
  _loadPromise = null;
}

// ─── Normalise a tag value (may be string or {name, color} object) ────────────
function tagName(t: unknown): string {
  if (!t) return '';
  if (typeof t === 'string') return t.trim().toLowerCase();
  if (typeof t === 'object' && t !== null && 'name' in t) return String((t as any).name).trim().toLowerCase();
  return String(t).trim().toLowerCase();
}

// ─── Load index from Firestore + localStorage ─────────────────────────────────
async function loadIndex(): Promise<void> {
  if (_index.loaded) return;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const docs: any[] = [];
    const corrSet = new Set<string>();
    const tagSet  = new Set<string>();
    const typeSet = new Set<string>();

    // ── Firestore documents ──
    try {
      const snap = await getDocs(collection(db, 'documents'));
      snap.forEach(d => {
        const data = { id: d.id, ...d.data() } as any;
        if (data.isDeleted) return;
        docs.push(data);
        if (data.client) corrSet.add(String(data.client));
        if (data.dept) corrSet.add(String(data.dept));
        if (data.category) typeSet.add(String(data.category));
        const rawTags: unknown[] = Array.isArray(data.tags) ? data.tags : [];
        rawTags.forEach(t => { const n = tagName(t); if (n) tagSet.add(n); });
      });
    } catch { /* offline */ }

    // ── localStorage documents ──
    try {
      const local: any[] = JSON.parse(localStorage.getItem('local_documents') || '[]');
      for (const d of local) {
        if (d.isDeleted) continue;
        // avoid duplicates already loaded from Firestore
        if (!docs.find((x: any) => x.id === d.id)) docs.push(d);
        if (d.client) corrSet.add(String(d.client));
        if (d.dept) corrSet.add(String(d.dept));
        if (d.category) typeSet.add(String(d.category));
        const rawTags: unknown[] = Array.isArray(d.tags) ? d.tags : [];
        rawTags.forEach(t => { const n = tagName(t); if (n) tagSet.add(n); });
      }
    } catch { /* empty */ }

    // ── Managed correspondents ──
    try {
      const snap = await getDocs(collection(db, 'correspondents'));
      snap.forEach(d => corrSet.add(d.data().name));
    } catch {}
    try {
      const local: any[] = JSON.parse(localStorage.getItem('local_correspondents') || '[]');
      local.forEach(c => c.name && corrSet.add(c.name));
    } catch {}

    // ── Managed tags ──
    try {
      const snap = await getDocs(collection(db, 'tags'));
      snap.forEach(d => tagSet.add(d.data().name));
    } catch {}
    try {
      const local: any[] = JSON.parse(localStorage.getItem('local_tags') || '[]');
      local.forEach(t => t.name && tagSet.add(tagName(t.name)));
    } catch {}

    // ── Document types ──
    try {
      const snap = await getDocs(collection(db, 'documentTypes'));
      snap.forEach(d => typeSet.add(d.data().name));
    } catch {}
    try {
      const local: any[] = JSON.parse(localStorage.getItem('local_documentTypes') || '[]');
      local.forEach(t => t.name && typeSet.add(t.name));
    } catch {}

    _index = {
      documents: docs,
      correspondents: Array.from(corrSet).filter(Boolean),
      tags: Array.from(tagSet).filter(Boolean),
      documentTypes: Array.from(typeSet).filter(Boolean),
      loaded: true,
    };
  })();

  return _loadPromise;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
// Returns 0–100. Always returns a number (never NaN/undefined).
function scoreStr(haystack: unknown, query: string): number {
  const h = String(haystack ?? '').toLowerCase().trim();
  if (!h || !query) return 0;
  const q = query.toLowerCase().trim();
  if (h === q)          return 100;
  if (h.startsWith(q))  return 90;
  if (h.includes(q))    return 70;
  // Word-level partial match
  const words = q.split(/\s+/).filter(w => w.length > 1);
  if (words.length === 0) return 0;
  const hits = words.filter(w => h.includes(w));
  return hits.length > 0 ? Math.round((hits.length / words.length) * 50) : 0;
}

function bestScore(values: unknown[], q: string): number {
  if (!values.length) return 0;
  return values.reduce<number>((best, v) => Math.max(best, scoreStr(v, q)), 0);
}

function makeSnippet(text: string, query: string): string {
  if (!text) return '';
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 90) + (text.length > 90 ? '…' : '');
  const start = Math.max(0, idx - 40);
  const end   = Math.min(text.length, idx + query.length + 80);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

// ─── Static pages ─────────────────────────────────────────────────────────────
const STATIC_PAGES = [
  { id: 'p-dash',     title: 'Dashboard',      route: '/' },
  { id: 'p-docs',     title: 'Documents',       route: '/documents' },
  { id: 'p-upload',   title: 'Upload Document', route: '/upload' },
  { id: 'p-corr',     title: 'Correspondents',  route: '/correspondents' },
  { id: 'p-tags',     title: 'Tags',            route: '/tags' },
  { id: 'p-types',    title: 'Document Types',  route: '/document-types' },
  { id: 'p-storage',  title: 'Storage Paths',   route: '/storage-paths' },
  { id: 'p-fields',   title: 'Custom Fields',   route: '/custom-fields' },
  { id: 'p-mail',     title: 'Mail Settings',   route: '/mail' },
  { id: 'p-config',   title: 'Configuration',   route: '/configuration' },
  { id: 'p-settings', title: 'Settings',        route: '/settings' },
];

// ─── Main search engine ───────────────────────────────────────────────────────
function runSearch(query: string): SearchResult[] {
  const q = query.trim();
  if (q.length < 1) return [];
  const results: SearchResult[] = [];

  // ── Documents ──
  for (const doc of _index.documents) {
    let best = 0;
    let snippet: string | undefined;

    // Search BOTH name and originalName independently (not short-circuit)
    best = Math.max(best, scoreStr(doc.name, q) * 1.2);
    best = Math.max(best, scoreStr(doc.originalName, q) * 1.1);

    // Correspondent / Client
    best = Math.max(best, scoreStr(doc.client, q));
    best = Math.max(best, scoreStr(doc.dept, q) * 0.8);

    // Category / type
    best = Math.max(best, scoreStr(doc.category, q) * 0.8);

    // Description / notes
    best = Math.max(best, scoreStr(doc.description, q) * 0.9);
    best = Math.max(best, scoreStr(doc.notes, q) * 0.9);

    // Date
    best = Math.max(best, scoreStr(doc.date, q) * 0.6);

    // Tags — handle both string[] and object[] formats
    const rawTags: unknown[] = Array.isArray(doc.tags) ? doc.tags : [];
    const normalizedTags = rawTags.map(tagName).filter(Boolean);
    best = Math.max(best, bestScore(normalizedTags, q) * 1.0);

    // Products
    const prods: unknown[] = Array.isArray(doc.products) ? doc.products : [];
    best = Math.max(best, bestScore(prods, q) * 0.8);

    // OCR / full text (most powerful — invoice#, BIN, phone numbers etc.)
    const ocrText: string = String(doc.text || doc.ocrText || doc.ocrContent || doc.content || '');
    if (ocrText) {
      const ocrScore = scoreStr(ocrText, q);
      if (ocrScore > 0) {
        best = Math.max(best, ocrScore * 1.1);
        snippet = makeSnippet(ocrText, q);
      }
    }

    if (best > 0) {
      results.push({
        id: doc.id,
        kind: 'document',
        title: doc.name || doc.originalName || 'Untitled',
        subtitle: [doc.client, doc.category].filter(Boolean).join(' · ') || doc.dept || '',
        meta: doc.date || '',
        score: Math.round(best),
        ocrSnippet: snippet,
        route: `/documents/${doc.id}`,
      });
    }
  }

  // ── Correspondents ──
  for (const name of _index.correspondents) {
    const s = scoreStr(name, q);
    if (s > 0) results.push({ id: `c_${name}`, kind: 'correspondent', title: name, subtitle: 'Correspondent', score: Math.round(s * 0.8), route: '/correspondents' });
  }

  // ── Tags ──
  for (const name of _index.tags) {
    const s = scoreStr(name, q);
    if (s > 0) results.push({ id: `t_${name}`, kind: 'tag', title: `#${name}`, subtitle: 'Tag', score: Math.round(s * 0.75), route: '/tags' });
  }

  // ── Document types ──
  for (const name of _index.documentTypes) {
    const s = scoreStr(name, q);
    if (s > 0) results.push({ id: `dt_${name}`, kind: 'document-type', title: name, subtitle: 'Document Type', score: Math.round(s * 0.7), route: '/document-types' });
  }

  // ── Pages ──
  for (const page of STATIC_PAGES) {
    const s = scoreStr(page.title, q);
    if (s > 0) results.push({ id: page.id, kind: 'page', title: page.title, subtitle: 'Navigation', score: Math.round(s * 0.5), route: page.route });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 25);
}

// ─── Visual helpers ───────────────────────────────────────────────────────────
function KindIcon({ kind, size = 14 }: { kind: SearchResultKind; size?: number }) {
  switch (kind) {
    case 'document':       return <FileText size={size} className="text-primary shrink-0" />;
    case 'correspondent':  return <Users size={size} className="text-blue-400 shrink-0" />;
    case 'tag':            return <Tag size={size} className="text-emerald-400 shrink-0" />;
    case 'document-type':  return <Folder size={size} className="text-violet-400 shrink-0" />;
    case 'storage-path':   return <HardDrive size={size} className="text-cyan-400 shrink-0" />;
    case 'custom-field':   return <SlidersHorizontal size={size} className="text-yellow-400 shrink-0" />;
    case 'page':           return <Zap size={size} className="text-muted-foreground shrink-0" />;
    default:               return <Search size={size} className="shrink-0" />;
  }
}

const KIND_LABEL: Record<SearchResultKind, string> = {
  document: 'Doc', correspondent: 'Person', tag: 'Tag',
  'document-type': 'Type', 'storage-path': 'Storage',
  'custom-field': 'Field', user: 'User', page: 'Page',
};
const KIND_COLOR: Record<SearchResultKind, string> = {
  document:        'bg-primary/15 text-primary border-primary/25',
  correspondent:   'bg-blue-400/15 text-blue-400 border-blue-400/25',
  tag:             'bg-emerald-400/15 text-emerald-400 border-emerald-400/25',
  'document-type': 'bg-violet-400/15 text-violet-400 border-violet-400/25',
  'storage-path':  'bg-cyan-400/15 text-cyan-400 border-cyan-400/25',
  'custom-field':  'bg-yellow-400/15 text-yellow-400 border-yellow-400/25',
  user:            'bg-pink-400/15 text-pink-400 border-pink-400/25',
  page:            'bg-muted text-muted-foreground border-border',
};

// ─── Search Overlay ───────────────────────────────────────────────────────────
function SearchOverlay({ onClose }: { onClose: () => void }) {
  const navigate  = useNavigate();
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const debounce  = useRef<ReturnType<typeof setTimeout>>();

  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState<SearchResult[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [indexLoading, setIndexLoading] = useState(!_index.loaded);
  const [cursor,       setCursor]       = useState(0);

  // Focus input + load index on mount
  useEffect(() => {
    inputRef.current?.focus();
    if (!_index.loaded) {
      setIndexLoading(true);
      loadIndex().then(() => setIndexLoading(false));
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounce.current = setTimeout(() => {
      const r = runSearch(query);
      setResults(r);
      setCursor(0);
      setLoading(false);
    }, 150);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelectorAll('[data-result]')[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const getRecent = (): string[] => {
    try { return JSON.parse(localStorage.getItem('dg_recent_searches') || '[]'); } catch { return []; }
  };
  const saveRecent = (q: string) => {
    const next = [q, ...getRecent().filter(r => r !== q)].slice(0, 6);
    localStorage.setItem('dg_recent_searches', JSON.stringify(next));
  };

  const go = (r: SearchResult) => {
    if (query.trim()) saveRecent(query.trim());
    onClose();
    navigate(r.route);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape')    { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === 'Enter' && results[cursor]) go(results[cursor]);
  };

  // Group results by kind
  const ORDER: SearchResultKind[] = ['document', 'correspondent', 'tag', 'document-type', 'page'];
  const grouped = ORDER.reduce<{ kind: SearchResultKind; items: SearchResult[] }[]>((acc, k) => {
    const items = results.filter(r => r.kind === k);
    if (items.length) acc.push({ kind: k, items });
    return acc;
  }, []);

  const recent = getRecent();

  const GROUP_LABELS: Record<string, string> = {
    document: 'Documents', correspondent: 'Correspondents',
    tag: 'Tags', 'document-type': 'Document Types', page: 'Navigation',
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center pt-[8vh] bg-black/70 backdrop-blur-md"
      onMouseDown={onClose}>
      <div className="w-full max-w-2xl mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onMouseDown={e => e.stopPropagation()}>

        {/* ── Input row ── */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
          {indexLoading || loading
            ? <Loader2 size={16} className="text-primary animate-spin shrink-0" />
            : <Search size={16} className="text-muted-foreground shrink-0" />}
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by name, tag, correspondent, invoice#, BIN, phone…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button onMouseDown={e => { e.preventDefault(); setQuery(''); inputRef.current?.focus(); }}
              className="text-muted-foreground hover:text-foreground p-0.5 transition-colors">
              <X size={14} />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 text-[10px] bg-muted border border-border rounded text-muted-foreground shrink-0">ESC</kbd>
        </div>

        {/* ── Index loading message ── */}
        {indexLoading && (
          <div className="flex items-center gap-2.5 px-4 py-3 text-xs text-muted-foreground border-b border-border">
            <Loader2 size={12} className="animate-spin text-primary" />
            Building index — scanning documents…
          </div>
        )}

        {/* ── Empty state ── */}
        {!query && !indexLoading && (
          <div className="max-h-[60vh] overflow-y-auto py-1.5">
            {recent.length > 0 && (
              <>
                <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock size={10} /> Recent Searches
                </p>
                {recent.map(r => (
                  <button key={r} onMouseDown={() => setQuery(r)}
                    className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors flex items-center gap-3">
                    <Clock size={13} className="text-muted-foreground shrink-0" />
                    {r}
                    <ChevronRight size={12} className="ml-auto text-muted-foreground" />
                  </button>
                ))}
                <div className="mx-4 border-t border-border my-1" />
              </>
            )}
            <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap size={10} /> Quick Jump
            </p>
            {[
              { label: 'All Documents',   route: '/documents',     Icon: FileText },
              { label: 'Upload Document', route: '/upload',        Icon: FileText },
              { label: 'Correspondents',  route: '/correspondents',Icon: Users },
              { label: 'Tags',            route: '/tags',          Icon: Tag },
            ].map(a => (
              <button key={a.route} onMouseDown={() => { onClose(); navigate(a.route); }}
                className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted/40 transition-colors flex items-center gap-3">
                <a.Icon size={13} className="text-muted-foreground shrink-0" />
                {a.label}
                <ChevronRight size={12} className="ml-auto text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* ── No results ── */}
        {query && !loading && !indexLoading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Search size={28} className="text-muted-foreground mb-3 opacity-40" />
            <p className="text-sm font-medium text-foreground mb-1">
              No results for <span className="text-primary">"{query}"</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Try the exact tag name (e.g. "dhaka"), a correspondent name, invoice number, or BIN.
            </p>
            <button onMouseDown={() => { invalidateSearchIndex(); setIndexLoading(true); loadIndex().then(() => setIndexLoading(false)); }}
              className="mt-3 text-xs text-primary hover:underline">
              Refresh index
            </button>
          </div>
        )}

        {/* ── Results ── */}
        {query && results.length > 0 && (
          <div ref={listRef} className="max-h-[62vh] overflow-y-auto">
            {grouped.map(({ kind, items }) => (
              <div key={kind}>
                {/* Section header */}
                <div className="sticky top-0 z-10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 border-y border-border flex items-center gap-2">
                  <KindIcon kind={kind} size={10} />
                  {GROUP_LABELS[kind] ?? kind}
                  <span className="opacity-60">({items.length})</span>
                </div>

                {items.map(r => {
                  const idx = results.indexOf(r);
                  const active = idx === cursor;
                  return (
                    <button key={r.id} data-result onMouseDown={() => go(r)}
                      className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 border-b border-border/40 ${
                        active ? 'bg-primary/12 ring-inset ring-1 ring-primary/30' : 'hover:bg-muted/30'
                      }`}>
                      <div className="mt-0.5">
                        <KindIcon kind={r.kind} size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground truncate">{r.title}</span>
                          {r.meta && <span className="text-[10px] text-muted-foreground shrink-0">{r.meta}</span>}
                        </div>
                        {r.subtitle && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{r.subtitle}</p>
                        )}
                        {r.ocrSnippet && (
                          <div className="mt-1.5 px-2.5 py-1.5 bg-primary/8 border border-primary/20 rounded-lg">
                            <span className="text-[9px] font-semibold uppercase tracking-widest text-primary/70 mr-1.5">OCR</span>
                            <span className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                              {r.ocrSnippet}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className={`shrink-0 self-start text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${KIND_COLOR[r.kind]}`}>
                        {KIND_LABEL[r.kind]}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="px-4 py-2 border-t border-border bg-muted/10 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[9px]">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[9px]">↵</kbd> Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[9px]">ESC</kbd> Close
          </span>
          {_index.loaded && (
            <span className="ml-auto opacity-60">
              {_index.documents.length} docs · {_index.correspondents.length} people · {_index.tags.length} tags
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSearch  = useCallback(() => setOpen(true),  []);
  const closeSearch = useCallback(() => setOpen(false), []);

  // Ctrl+K / Cmd+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(o => !o); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <GlobalSearchContext.Provider value={{ open, openSearch, closeSearch }}>
      {children}
      {open && <SearchOverlay onClose={closeSearch} />}
    </GlobalSearchContext.Provider>
  );
}
