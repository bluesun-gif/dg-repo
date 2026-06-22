import React, { useState, useEffect, useRef } from 'react';
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  FolderOpen, Plus, Pencil, Trash2, Search, ChevronDown,
  Check, X, ShieldCheck, AlertCircle, Loader2, ChevronLeft,
  ChevronRight, Info, Eye,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StoragePath {
  id: string;
  name: string;
  path: string;
  matching: string;
  matchText?: string;
  ownerName?: string;
  ownerId?: string;
  viewUsers?: string[];
  viewGroups?: string[];
  editUsers?: string[];
  editGroups?: string[];
  createdAt?: string;
  // computed
  docCount?: number;
}

const MATCHING_ALGORITHMS = [
  { value: 'auto',  label: 'Auto: Learn matching automatically' },
  { value: 'any',   label: 'Any: Document contains any of these words (space separated)' },
  { value: 'all',   label: 'All: Document contains all of these words (space separated)' },
  { value: 'exact', label: 'Exact: Document contains this string' },
  { value: 'regex', label: 'Regular expression: Document matches this regular expression' },
  { value: 'fuzzy', label: 'Fuzzy: Document contains a word similar to this word' },
  { value: 'none',  label: 'None: Disable matching' },
];

const ITEMS_PER_PAGE = 25;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function matchingLabel(v: string) {
  return MATCHING_ALGORITHMS.find(a => a.value === v)?.label.split(':')[0] ?? v;
}

// ─── Matching dropdown ────────────────────────────────────────────────────────
function MatchingSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = MATCHING_ALGORITHMS.find(a => a.value === value) ?? MATCHING_ALGORITHMS[0];

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between h-9 px-3 bg-muted/40 border border-border rounded-lg text-sm text-foreground hover:border-primary/50 transition-colors">
        <span className="truncate text-left">{current.label}</span>
        <ChevronDown size={13} className={`ml-2 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden py-1">
          {MATCHING_ALGORITHMS.map(a => (
            <button key={a.value} onClick={() => { onChange(a.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                value === a.value ? 'bg-primary/15 text-primary font-medium' : 'text-foreground hover:bg-muted/60'
              }`}>
              {value === a.value && <Check size={12} className="shrink-0" />}
              <span className={value !== a.value ? 'ml-4' : ''}>{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Permissions accordion ────────────────────────────────────────────────────
function PermissionsSection({ ownerName, setOwnerName, viewUsers, setViewUsers, viewGroups, setViewGroups, editUsers, setEditUsers, editGroups, setEditGroups }: {
  ownerName: string; setOwnerName: (v: string) => void;
  viewUsers: string; setViewUsers: (v: string) => void;
  viewGroups: string; setViewGroups: (v: string) => void;
  editUsers: string; setEditUsers: (v: string) => void;
  editGroups: string; setEditGroups: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-sm font-medium text-primary">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} />
          Edit Permissions
        </div>
        <ChevronDown size={13} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 py-4 space-y-4 border-t border-border bg-card">
          <div className="flex items-center gap-4">
            <label className="text-sm text-muted-foreground w-20 shrink-0">Owner:</label>
            <Input value={ownerName} onChange={e => setOwnerName(e.target.value)}
              placeholder="Username or email" className="h-8 text-sm bg-muted/40 border-border" />
          </div>
          <p className="text-[11px] text-primary ml-24 -mt-2">Objects without an owner can be viewed and edited by all users</p>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">View</p>
            <div className="flex items-center gap-4">
              <label className="text-sm text-muted-foreground w-20 shrink-0">Users:</label>
              <Input value={viewUsers} onChange={e => setViewUsers(e.target.value)} placeholder="Comma-separated usernames" className="h-8 text-sm bg-muted/40 border-border" />
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm text-muted-foreground w-20 shrink-0">Groups:</label>
              <Input value={viewGroups} onChange={e => setViewGroups(e.target.value)} placeholder="Comma-separated groups" className="h-8 text-sm bg-muted/40 border-border" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Edit</p>
            <div className="flex items-center gap-4">
              <label className="text-sm text-muted-foreground w-20 shrink-0">Users:</label>
              <Input value={editUsers} onChange={e => setEditUsers(e.target.value)} placeholder="Comma-separated usernames" className="h-8 text-sm bg-muted/40 border-border" />
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm text-muted-foreground w-20 shrink-0">Groups:</label>
              <Input value={editGroups} onChange={e => setEditGroups(e.target.value)} placeholder="Comma-separated groups" className="h-8 text-sm bg-muted/40 border-border" />
            </div>
            <p className="text-[11px] text-primary ml-24">Edit permissions also grant viewing permissions</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Preview accordion ────────────────────────────────────────────────────────
function PreviewSection({ path, allDocs }: { path: string; allDocs: { name: string; dept: string; client: string }[] }) {
  const [open, setOpen] = useState(false);
  const [docSearch, setDocSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState('');

  const filteredDocs = allDocs.filter(d =>
    d.name.toLowerCase().includes(docSearch.toLowerCase()) ||
    d.client.toLowerCase().includes(docSearch.toLowerCase())
  ).slice(0, 10);

  const previewPath = (docName: string) => {
    if (!path || !docName) return '';
    return path
      .replace('{correspondent}', allDocs.find(d => d.name === docName)?.client || 'unknown')
      .replace('{document_type}', 'invoice')
      .replace('{created}', new Date().toISOString().slice(0, 10))
      .replace('{title}', docName.replace(/\.[^.]+$/, ''))
      .replace('{owner_username}', 'user');
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-sm font-medium text-foreground">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-muted-foreground" />
          Preview
        </div>
        <ChevronDown size={13} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 py-4 space-y-3 border-t border-border bg-card">
          <div className="h-8 px-3 bg-muted/40 border border-border rounded-lg text-sm text-muted-foreground flex items-center">
            {selectedDoc || 'No document selected'}
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={docSearch} onChange={e => setDocSearch(e.target.value)}
              placeholder="Search for a document" className="pl-7 h-8 text-sm bg-muted/40 border-border" />
          </div>
          {docSearch && filteredDocs.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              {filteredDocs.map(d => (
                <button key={d.name} onClick={() => { setSelectedDoc(d.name); setDocSearch(''); }}
                  className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted/60 transition-colors border-b border-border last:border-0">
                  {d.name}
                </button>
              ))}
            </div>
          )}
          {selectedDoc && path && (
            <div className="bg-muted/30 rounded-lg px-3 py-2">
              <p className="text-[10px] text-muted-foreground mb-1">Preview path:</p>
              <p className="text-xs font-mono text-primary break-all">{previewPath(selectedDoc)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Confirm delete ───────────────────────────────────────────────────────────
function ConfirmDialog({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm mx-4 p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
            <AlertCircle size={18} className="text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Delete storage path?</p>
            <p className="text-xs text-muted-foreground mt-0.5">This won't affect existing documents.</p>
          </div>
        </div>
        <p className="text-sm bg-muted/40 rounded-lg px-3 py-2 mb-5 font-medium text-foreground">{name}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold text-white bg-destructive rounded-lg hover:bg-destructive/90 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit modal ──────────────────────────────────────────────────────
function StoragePathModal({ mode, initial, allDocs, onSave, onClose }: {
  mode: 'create' | 'edit';
  initial?: StoragePath;
  allDocs: { name: string; dept: string; client: string }[];
  onSave: (data: Omit<StoragePath, 'id' | 'docCount'>) => Promise<void>;
  onClose: () => void;
}) {
  const { currentUser, userProfile } = useAuth();
  const [name, setName] = useState(initial?.name || '');
  const [path, setPath] = useState(initial?.path || '');
  const [matching, setMatching] = useState(initial?.matching || 'auto');
  const [matchText, setMatchText] = useState(initial?.matchText || '');
  const [ownerName, setOwnerName] = useState(initial?.ownerName || userProfile?.name || currentUser?.email || '');
  const [viewUsers, setViewUsers] = useState((initial?.viewUsers || []).join(', '));
  const [viewGroups, setViewGroups] = useState((initial?.viewGroups || []).join(', '));
  const [editUsers, setEditUsers] = useState((initial?.editUsers || []).join(', '));
  const [editGroups, setEditGroups] = useState((initial?.editGroups || []).join(', '));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (!path.trim()) { toast.error('Path is required'); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(), path: path.trim(), matching, matchText: matchText.trim(),
        ownerName: ownerName.trim(), ownerId: currentUser?.uid,
        viewUsers: viewUsers.split(',').map(s => s.trim()).filter(Boolean),
        viewGroups: viewGroups.split(',').map(s => s.trim()).filter(Boolean),
        editUsers: editUsers.split(',').map(s => s.trim()).filter(Boolean),
        editGroups: editGroups.split(',').map(s => s.trim()).filter(Boolean),
        createdAt: initial?.createdAt || new Date().toISOString(),
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-10 pb-8 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-400/10 flex items-center justify-center">
              <FolderOpen size={16} className="text-emerald-400" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                {mode === 'create' ? 'Create storage path' : 'Edit storage path'}
              </h2>
              {mode === 'edit' && initial?.id && !initial.id.startsWith('auto_') && (
                <span className="text-[10px] px-2 py-0.5 bg-primary/20 text-primary rounded-full font-mono">
                  ID:{initial.id.slice(-4)}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Name <span className="text-destructive">*</span></label>
            <Input value={name} onChange={e => setName(e.target.value)} autoFocus
              placeholder="e.g. Invoices, Contracts, HR Documents..."
              className="h-9 text-sm bg-muted/40 border-border focus-visible:ring-primary" />
          </div>

          {/* Path */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Path <span className="text-destructive">*</span></label>
            <textarea value={path} onChange={e => setPath(e.target.value)} rows={3}
              placeholder="{correspondent}/{document_type}/{created}/{title}"
              className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Info size={11} className="mt-0.5 shrink-0 text-primary/60" />
              <span>Use variables: <code className="text-primary/80">{'{correspondent}'}</code> <code className="text-primary/80">{'{document_type}'}</code> <code className="text-primary/80">{'{created}'}</code> <code className="text-primary/80">{'{title}'}</code> <code className="text-primary/80">{'{owner_username}'}</code></span>
            </div>
          </div>

          {/* Preview */}
          <PreviewSection path={path} allDocs={allDocs} />

          {/* Matching */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Matching algorithm</label>
            <MatchingSelect value={matching} onChange={setMatching} />
            {matching !== 'auto' && matching !== 'none' && (
              <Input value={matchText} onChange={e => setMatchText(e.target.value)}
                placeholder="Enter matching pattern / keywords..."
                className="h-9 text-sm bg-muted/40 border-border mt-2" />
            )}
          </div>

          {/* Permissions */}
          <PermissionsSection
            ownerName={ownerName} setOwnerName={setOwnerName}
            viewUsers={viewUsers} setViewUsers={setViewUsers}
            viewGroups={viewGroups} setViewGroups={setViewGroups}
            editUsers={editUsers} setEditUsers={setEditUsers}
            editGroups={editGroups} setEditGroups={setEditGroups}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !path.trim()}
            className="px-5 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
            {saving ? <><Loader2 size={13} className="animate-spin" /> Saving...</> : <><Check size={13} /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StoragePaths() {
  const navigate = useNavigate();
  const [items, setItems] = useState<StoragePath[]>([]);
  const [allDocs, setAllDocs] = useState<{ name: string; dept: string; client: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<StoragePath | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoragePath | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const managed: StoragePath[] = [];
    const docCounts: Record<string, number> = {};

    // Load storage paths from Firestore
    try {
      const snap = await getDocs(collection(db, 'storagePaths'));
      snap.forEach(d => {
        const data = d.data();
        managed.push({ id: d.id, name: data.name, path: data.path || '', matching: data.matching || 'auto', matchText: data.matchText, ownerName: data.ownerName, ownerId: data.ownerId, viewUsers: data.viewUsers || [], viewGroups: data.viewGroups || [], editUsers: data.editUsers || [], editGroups: data.editGroups || [], createdAt: data.createdAt, docCount: 0 });
      });
    } catch {}

    // Load docs for preview + count
    const docs: typeof allDocs = [];
    try {
      const snap = await getDocs(collection(db, 'documents'));
      snap.forEach(d => {
        const data = d.data();
        if (!data.isDeleted) {
          docs.push({ name: data.name || data.originalName || '', dept: data.dept || '', client: data.client || '' });
          if (data.dept) docCounts[data.dept] = (docCounts[data.dept] || 0) + 1;
        }
      });
    } catch {}
    try {
      const local = JSON.parse(localStorage.getItem('local_documents') || '[]');
      local.forEach((d: any) => {
        if (!d.isDeleted) {
          docs.push({ name: d.name || d.originalName || '', dept: d.dept || '', client: d.client || '' });
          if (d.dept) docCounts[d.dept] = (docCounts[d.dept] || 0) + 1;
        }
      });
    } catch {}

    setAllDocs(docs);
    setItems(managed.map(m => ({ ...m, docCount: docCounts[m.name] || 0 })).sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async (data: Omit<StoragePath, 'id' | 'docCount'>) => {
    if (items.find(i => i.name.toLowerCase() === data.name.toLowerCase())) {
      toast.error('A storage path with this name already exists'); throw new Error('duplicate');
    }
    try { await addDoc(collection(db, 'storagePaths'), data); } catch {}
    toast.success(`Storage path "${data.name}" created`);
    fetchAll();
  };

  const handleEdit = async (data: Omit<StoragePath, 'id' | 'docCount'>) => {
    if (!editTarget) return;
    try { await updateDoc(doc(db, 'storagePaths', editTarget.id), data as any); } catch {}
    toast.success(`Storage path "${data.name}" updated`);
    fetchAll();
  };

  const handleDelete = async (item: StoragePath) => {
    try { await deleteDoc(doc(db, 'storagePaths', item.id)); } catch {}
    setItems(prev => prev.filter(i => i.id !== item.id));
    setDeleteTarget(null);
    toast.success(`Storage path "${item.name}" deleted`);
  };

  const handleBulkDelete = async () => {
    for (const id of selected) {
      try { await deleteDoc(doc(db, 'storagePaths', id)); } catch {}
    }
    setItems(prev => prev.filter(i => !selected.has(i.id)));
    toast.success(`${selected.size} path${selected.size > 1 ? 's' : ''} deleted`);
    setSelected(new Set());
  };

  const filtered = items.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.path.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(prev => prev.size === paginated.length ? new Set() : new Set(paginated.map(i => i.id)));

  const countLabel = (n: number) => {
    if (n === 0) return '0 storage paths';
    if (n === 1) return 'One storage path';
    return `${n} storage paths`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-400/10 flex items-center justify-center">
            <FolderOpen size={18} className="text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">Storage Paths</h1>
              <Info size={13} className="text-muted-foreground cursor-help" title="Storage paths define how documents are organized on disk" />
            </div>
            <p className="text-xs text-muted-foreground">Define folder structures for document organization</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/40 rounded-lg hover:bg-destructive/10 transition-colors">
              <Trash2 size={13} /> Delete ({selected.size})
            </button>
          )}
          <button onClick={() => { setShowModal('create'); setEditTarget(null); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors">
            <Plus size={15} /> Create
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <span className="text-xs text-muted-foreground shrink-0">Filter by:</span>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Name" className="pl-7 h-8 text-xs w-52 bg-muted/40 border-border" />
        </div>
        {search && <button onClick={() => setSearch('')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"><X size={11} /> Clear</button>}
        {totalPages > 1 && (
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-1 rounded hover:bg-muted/50 disabled:opacity-30 transition-colors"><ChevronLeft size={13} /></button>
            <span className="px-2 py-0.5 bg-primary text-white rounded text-xs font-medium">{page}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="p-1 rounded hover:bg-muted/50 disabled:opacity-30 transition-colors"><ChevronRight size={13} /></button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <FolderOpen size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No storage paths found</p>
            <p className="text-xs text-muted-foreground mb-4">
              {search ? 'Try a different search.' : 'Create your first storage path to organize documents.'}
            </p>
            {!search && (
              <button onClick={() => setShowModal('create')}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors">
                <Plus size={14} /> Create storage path
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={selected.size === paginated.length && paginated.length > 0}
                    onChange={toggleAll} className="w-4 h-4 rounded border-border bg-muted/40 accent-primary cursor-pointer" />
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Matching</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Document count</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Path</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map(item => (
                <tr key={item.id} className={`group hover:bg-muted/20 transition-colors ${selected.has(item.id) ? 'bg-primary/5' : ''}`}>
                  <td className="w-10 px-4 py-3">
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)}
                      className="w-4 h-4 rounded border-border bg-muted/40 accent-primary cursor-pointer" />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-primary group-hover:underline cursor-pointer" onClick={() => { setEditTarget(item); setShowModal('edit'); }}>
                      {item.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                      {matchingLabel(item.matching || 'auto')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{item.docCount ?? 0}</td>
                  <td className="px-4 py-3">
                    <code className="text-xs text-primary/80 font-mono bg-muted/40 px-1.5 py-0.5 rounded">
                      {item.path.length > 40 ? item.path.slice(0, 40) + '…' : item.path}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditTarget(item); setShowModal('edit'); }}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Pencil size={11} /> Edit
                      </button>
                      <button onClick={() => setDeleteTarget(item)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs border border-destructive/30 rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      {!loading && (
        <div className="px-6 py-2 border-t border-border shrink-0">
          <p className="text-xs text-muted-foreground">
            {countLabel(filtered.length)}
            {selected.size > 0 && <span className="text-primary ml-2">· {selected.size} selected</span>}
          </p>
        </div>
      )}

      {/* Modals */}
      {(showModal === 'create' || showModal === 'edit') && (
        <StoragePathModal
          mode={showModal}
          initial={showModal === 'edit' ? editTarget ?? undefined : undefined}
          allDocs={allDocs}
          onSave={showModal === 'create' ? handleCreate : handleEdit}
          onClose={() => { setShowModal(null); setEditTarget(null); }}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog name={deleteTarget.name} onConfirm={() => handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
