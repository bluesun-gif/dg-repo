import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';
import DocCard from '@/components/DocCard';
import { toast } from 'sonner';
import { parseSizeMb } from '@/lib/utils';
import {
  Tag, User, FileType, HardDrive, Calendar, Shield,
  X, LayoutGrid, List, SlidersHorizontal, ChevronDown,
  BarChart3, RotateCcw, ChevronLeft, ChevronRight, AlignJustify,
} from 'lucide-react';

interface DocItem {
  id: string;
  name: string;
  originalName?: string;
  dept?: string;
  client?: string;
  category?: string;
  date?: string;
  createdAt?: string;
  size?: string;
  tags?: string[];
  products?: string[];
  confidentiality?: string;
  summary?: string;
  text?: string;
  fileUrl?: string;
  htmlContent?: string;
  uploadedBy?: string;
  ownerId?: string;
  permissions?: Record<string, string>;
  isDeleted?: boolean;
}

type ViewMode = 'grid' | 'list' | 'detail';
type SortBy = 'created' | 'date' | 'name' | 'size';
type PermFilter = 'all' | 'mine' | 'shared-with-me' | 'shared-by-me' | 'unowned';

const ITEMS_PER_PAGE = 25;

function loadLocalDocs(): DocItem[] {
  try {
    const all = JSON.parse(localStorage.getItem('local_documents') || '[]');
    return all.filter((d: DocItem) => !d.isDeleted);
  } catch { return []; }
}

function FilterChip({ label, icon: Icon, value, options, onChange, onClear }: {
  label: string;
  icon: React.ElementType;
  value: string;
  options?: string[];
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasValue = !!value;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
          hasValue
            ? 'bg-primary/15 border-primary/50 text-primary'
            : 'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
        }`}
      >
        <Icon size={11} />
        {label}
        {hasValue && <span className="ml-0.5 opacity-80">· {value}</span>}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl min-w-40 py-1 overflow-hidden">
            <button onClick={() => { onClear(); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 transition-colors flex items-center gap-1.5">
              <X size={10} /> Clear filter
            </button>
            {options?.map(opt => (
              <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-muted/60 ${
                  value === opt ? 'text-primary font-medium' : 'text-foreground'
                }`}>
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PermissionsDropdown({ value, onChange }: { value: PermFilter; onChange: (v: PermFilter) => void }) {
  const [open, setOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const hasValue = value !== 'all';
  const label = value === 'all' ? 'Permissions' : value === 'mine' ? 'My documents' : value === 'shared-with-me' ? 'Shared with me' : value === 'shared-by-me' ? 'Shared by me' : 'Unowned';

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
          hasValue ? 'bg-primary/15 border-primary/50 text-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/40'
        }`}>
        <Shield size={11} /> {label}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl w-52 py-1 overflow-hidden">
            {([
              { v: 'all', l: 'All' },
              { v: 'mine', l: 'My documents' },
              { v: 'shared-with-me', l: 'Shared with me' },
              { v: 'shared-by-me', l: 'Shared by me' },
              { v: 'unowned', l: 'Unowned' },
            ] as { v: PermFilter; l: string }[]).map(o => (
              <button key={o.v} onClick={() => { onChange(o.v); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-muted/60 transition-colors ${
                  value === o.v ? 'text-primary' : 'text-foreground'
                }`}>
                {value === o.v && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                {value !== o.v && <div className="w-1.5 h-1.5" />}
                {o.l}
              </button>
            ))}
            <div className="border-t border-border mt-1 pt-1 px-3">
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                placeholder="Users" className="w-full h-7 bg-muted/40 border border-border rounded px-2 text-xs text-foreground focus:outline-none" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function DocumentsList() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('created');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filters
  const [filterTag, setFilterTag] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterPerm, setFilterPerm] = useState<PermFilter>('all');
  const [filterUploadedBy, setFilterUploadedBy] = useState('');
  const [searchText, setSearchText] = useState(searchParams.get('q') || '');

  const tagName = (t: unknown): string => {
    if (!t) return '';
    if (typeof t === 'string') return t.trim().toLowerCase();
    if (typeof t === 'object' && t !== null && 'name' in t) return String((t as any).name).trim().toLowerCase();
    return String(t).trim().toLowerCase();
  };

  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam !== null) setSearchText(qParam);

    const tagParam = searchParams.get('tag');
    if (tagParam !== null) setFilterTag(tagParam);

    const clientParam = searchParams.get('client');
    if (clientParam !== null) setFilterClient(clientParam);

    const catParam = searchParams.get('category');
    if (catParam !== null) setFilterCategory(catParam);

    const deptParam = searchParams.get('dept');
    if (deptParam !== null) setFilterDept(deptParam);

    const uploadedByParam = searchParams.get('uploadedBy');
    if (uploadedByParam !== null) setFilterUploadedBy(uploadedByParam);
  }, [searchParams]);

  // ── Load documents ──
  const loadDocs = useCallback(async () => {
    setLoading(true);
    const uid = currentUser?.uid || 'anon';

    // Load from Firestore
    let firestoreDocs: DocItem[] = [];
    try {
      const snap = await getDocs(collection(db, 'documents'));
      firestoreDocs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as DocItem))
        .filter(d => !d.isDeleted);
    } catch {}

    // Load from localStorage
    const localDocs = loadLocalDocs();

    // Merge: prefer Firestore, then local-only
    const firestoreIds = new Set(firestoreDocs.map(d => d.id));
    const localOnly = localDocs.filter(d => !firestoreIds.has(d.id));

    // Also pull localStorage versions that have fileUrl (DataURL) for those in Firestore
    const enriched = firestoreDocs.map(fd => {
      const local = localDocs.find(ld => ld.id === fd.id);
      return local ? { ...fd, fileUrl: local.fileUrl || fd.fileUrl, text: local.text || fd.text } : fd;
    });

    setDocs([...enriched, ...localOnly]);
    setLoading(false);
  }, [currentUser?.uid]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  // ── Filter & sort ──
  const uid = currentUser?.uid || '';
  const filtered = docs.filter(d => {
    if (searchText) {
      const q = searchText.toLowerCase().trim();
      const terms = q.split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        const isMatched = terms.every(term => {
          return (
            d.name.toLowerCase().includes(term) ||
            d.originalName?.toLowerCase().includes(term) ||
            d.text?.toLowerCase().includes(term) ||
            d.client?.toLowerCase().includes(term) ||
            d.category?.toLowerCase().includes(term) ||
            d.dept?.toLowerCase().includes(term) ||
            d.notes?.toLowerCase().includes(term) ||
            d.uploadedBy?.toLowerCase().includes(term) ||
            d.uploadedByName?.toLowerCase().includes(term) ||
            (d.tags || []).some(t => tagName(t).includes(term)) ||
            (d.products || []).some(p => String(p).toLowerCase().includes(term))
          );
        });
        if (!isMatched) return false;
      }
    }
    if (filterTag && !(d.tags || []).includes(filterTag)) return false;
    if (filterClient && d.client?.toLowerCase() !== filterClient.toLowerCase()) return false;
    if (filterCategory && d.category !== filterCategory) return false;
    if (filterDept && d.dept !== filterDept) return false;
    if (filterDate && d.date !== filterDate && d.createdAt?.slice(0, 10) !== filterDate) return false;
    if (filterUploadedBy && d.uploadedBy?.toLowerCase() !== filterUploadedBy.toLowerCase()) return false;
    if (filterPerm === 'mine' && d.ownerId !== uid) return false;
    if (filterPerm === 'unowned' && d.ownerId) return false;
    if (filterPerm === 'shared-with-me' && !(d.permissions && d.permissions[uid] && d.ownerId !== uid)) return false;
    if (filterPerm === 'shared-by-me' && !(d.ownerId === uid && Object.keys(d.permissions || {}).length > 1)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortBy === 'date') cmp = (a.date || '').localeCompare(b.date || '');
    else if (sortBy === 'size') {
      const sizeA = a.sizeBytesRaw || (a.size ? parseSizeMb(a.size) * 1024 * 1024 : 0);
      const sizeB = b.sizeBytesRaw || (b.size ? parseSizeMb(b.size) * 1024 * 1024 : 0);
      cmp = sizeA - sizeB;
    } else cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
    return sortAsc ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const hasFilters = filterTag || filterClient || filterCategory || filterDept || filterDate || filterPerm !== 'all' || searchText || filterUploadedBy;
  const allTags = [...new Set(docs.flatMap(d => d.tags || []))].filter((x): x is string => Boolean(x));
  const allClients = [...new Set(docs.map(d => d.client).filter((x): x is string => Boolean(x)))];
  const allCategories = [...new Set(docs.map(d => d.category).filter((x): x is string => Boolean(x)))];
  const allDepts = [...new Set(docs.map(d => d.dept).filter((x): x is string => Boolean(x)))];

  const handleSelect = (id: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const selectPage = () => {
    const ids = paginated.map(d => d.id);
    setSelected(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next; });
  };

  const selectAll = () => setSelected(new Set(sorted.map(d => d.id)));

  const clearFilters = () => {
    setFilterTag(''); setFilterClient(''); setFilterCategory('');
    setFilterDept(''); setFilterDate(''); setFilterPerm('all'); setSearchText('');
    setFilterUploadedBy('');
    setSearchParams({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-2xl font-bold text-foreground">Documents</h1>
        <div className="flex items-center gap-2">
          {/* Select controls */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
            <span>Select:</span>
            <button onClick={selectPage} className="px-2 py-1 border border-border rounded hover:bg-muted/50 text-foreground transition-colors">
              Page
            </button>
            <button onClick={selectAll} className="px-2 py-1 border border-border rounded hover:bg-muted/50 text-foreground transition-colors">
              All
            </button>
            {selected.size > 0 && (
              <span className="text-primary ml-1">({selected.size} selected)</span>
            )}
          </div>

          {/* Show/Sort/Views */}
          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-xs text-muted-foreground hover:bg-muted/50 transition-colors">
              <BarChart3 size={12} /> Show
            </button>
            <div className="relative group flex items-center border border-border rounded overflow-hidden">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortBy)}
                className="bg-transparent text-xs text-muted-foreground px-2 py-1 focus:outline-none border-r border-border cursor-pointer hover:bg-muted/30"
              >
                <option value="created">Date Uploaded</option>
                <option value="date">Document Date</option>
                <option value="name">Name</option>
                <option value="size">Size</option>
              </select>
              <button
                onClick={() => setSortAsc(a => !a)}
                title={sortAsc ? "Sort Ascending" : "Sort Descending"}
                className="p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <SlidersHorizontal size={12} className={sortAsc ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
            </div>
            <div className="flex items-center border border-border rounded overflow-hidden">
              <button onClick={() => setViewMode('list')}
                className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}>
                <AlignJustify size={14} />
              </button>
              <button onClick={() => setViewMode('grid')}
                className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}>
                <LayoutGrid size={14} />
              </button>
              <button onClick={() => setViewMode('detail')}
                className={`p-1.5 transition-colors ${viewMode === 'detail' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}>
                <List size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-2 px-6 py-2.5 border-b border-border bg-background/50 shrink-0 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-full text-xs min-w-40">
          <span className="text-muted-foreground">Title &amp; content</span>
          <ChevronDown size={10} className="text-muted-foreground" />
          <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search..."
            className="bg-transparent text-foreground focus:outline-none w-24 placeholder:text-muted-foreground/50" />
        </div>

        <FilterChip label="Tags" icon={Tag} value={filterTag} options={allTags as string[]} onChange={setFilterTag} onClear={() => setFilterTag('')} />
        <FilterChip label="Correspondent" icon={User} value={filterClient} options={allClients as string[]} onChange={setFilterClient} onClear={() => setFilterClient('')} />
        <FilterChip label="Document type" icon={FileType} value={filterCategory} options={allCategories as string[]} onChange={setFilterCategory} onClear={() => setFilterCategory('')} />
        <FilterChip label="Storage path" icon={HardDrive} value={filterDept} options={allDepts as string[]} onChange={setFilterDept} onClear={() => setFilterDept('')} />
        <FilterChip label="Dates" icon={Calendar} value={filterDate} onChange={setFilterDate} onClear={() => setFilterDate('')} />
        <PermissionsDropdown value={filterPerm} onChange={setFilterPerm} />

        {hasFilters && (
          <button onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <X size={11} /> Reset filters
          </button>
        )}
      </div>

      {/* ── Doc count + pagination ── */}
      <div className="flex items-center justify-between px-6 py-2 shrink-0">
        <p className="text-sm text-muted-foreground">
          {sorted.length} document{sorted.length !== 1 ? 's' : ''}
          {hasFilters && <span className="text-xs text-primary ml-1">(filtered)</span>}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-1 rounded hover:bg-muted/50 disabled:opacity-40 transition-colors">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded text-xs transition-colors ${page === p ? 'bg-primary text-white' : 'hover:bg-muted/50 text-foreground'}`}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="p-1 rounded hover:bg-muted/50 disabled:opacity-40 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Documents grid / list ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <FileType size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No documents found</p>
            <p className="text-xs text-muted-foreground">
              {hasFilters ? 'Try clearing the filters' : 'Upload documents to get started'}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-2 text-xs text-primary hover:underline flex items-center gap-1">
                <RotateCcw size={11} /> Clear filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 mt-2">
            {paginated.map(doc => (
              <DocCard
                key={doc.id}
                doc={doc}
                selected={selected.has(doc.id)}
                onSelect={handleSelect}
              />
            ))}
          </div>
        ) : (
          /* List view */
          <div className="space-y-1 mt-2">
            {paginated.map(doc => (
              <div key={doc.id}
                onClick={() => navigate(`/documents/${doc.id}`)}
                className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/50 cursor-pointer transition-all group">
                <div onClick={e => { e.stopPropagation(); handleSelect(doc.id, !selected.has(doc.id)); }}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selected.has(doc.id) ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                  }`}>
                  {selected.has(doc.id) && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center shrink-0">
                  <FileType size={14} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.originalName || doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.client} · {doc.date || doc.createdAt?.slice(0, 10)}</p>
                </div>
                {(doc.tags || []).slice(0, 3).map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full">#{t}</span>
                ))}
                <span className="text-xs text-muted-foreground shrink-0">{doc.size}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
