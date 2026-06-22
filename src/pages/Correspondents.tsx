import React, { useState, useEffect, useRef } from 'react';
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users, Plus, Pencil, Trash2, Search, ChevronDown,
  Check, X, ShieldCheck, AlertCircle, Loader2, Building2,
  FileText, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Correspondent {
  id: string;
  name: string;
  matching: string;
  matchText?: string;
  ownerId?: string;
  ownerName?: string;
  viewUsers?: string[];
  viewGroups?: string[];
  editUsers?: string[];
  editGroups?: string[];
  createdAt?: string;
  // computed
  docCount?: number;
  lastUsed?: string;
}

const MATCHING_ALGORITHMS = [
  { value: 'auto', label: 'Auto: Learn matching automatically' },
  { value: 'any', label: 'Any: Document contains any of these words (space separated)' },
  { value: 'all', label: 'All: Document contains all of these words (space separated)' },
  { value: 'exact', label: 'Exact: Document contains this string' },
  { value: 'regex', label: 'Regular expression: Document matches this regular expression' },
  { value: 'fuzzy', label: 'Fuzzy: Document contains a word similar to this word' },
  { value: 'none', label: 'None: Disable matching' },
];

const ITEMS_PER_PAGE = 25;

// ─── Confirm Delete Dialog ────────────────────────────────────────────────────
function ConfirmDialog({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm mx-4 p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
            <AlertCircle size={18} className="text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Delete correspondent?</p>
            <p className="text-xs text-muted-foreground mt-0.5">This won't affect existing documents.</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 mb-5 font-medium text-foreground">
          {name}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold text-white bg-destructive rounded-lg hover:bg-destructive/90 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Matching Algorithm Select ────────────────────────────────────────────────
function MatchingSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = MATCHING_ALGORITHMS.find(a => a.value === value) || MATCHING_ALGORITHMS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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

// ─── Permissions Section ──────────────────────────────────────────────────────
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
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-sm font-medium text-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-primary" />
          Edit Permissions
        </div>
        <ChevronDown size={13} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 py-4 space-y-4 border-t border-border bg-card">
          {/* Owner */}
          <div className="flex items-center gap-4">
            <label className="text-sm text-muted-foreground w-20 shrink-0">Owner:</label>
            <Input value={ownerName} onChange={e => setOwnerName(e.target.value)}
              placeholder="Username or email" className="h-8 text-sm bg-muted/40 border-border" />
          </div>
          <p className="text-[11px] text-primary -mt-2 ml-24">Objects without an owner can be viewed and edited by all users</p>

          {/* View */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">View</p>
            <div className="flex items-center gap-4">
              <label className="text-sm text-muted-foreground w-20 shrink-0">Users:</label>
              <Input value={viewUsers} onChange={e => setViewUsers(e.target.value)}
                placeholder="Comma-separated usernames" className="h-8 text-sm bg-muted/40 border-border" />
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm text-muted-foreground w-20 shrink-0">Groups:</label>
              <Input value={viewGroups} onChange={e => setViewGroups(e.target.value)}
                placeholder="Comma-separated groups" className="h-8 text-sm bg-muted/40 border-border" />
            </div>
          </div>

          {/* Edit */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Edit</p>
            <div className="flex items-center gap-4">
              <label className="text-sm text-muted-foreground w-20 shrink-0">Users:</label>
              <Input value={editUsers} onChange={e => setEditUsers(e.target.value)}
                placeholder="Comma-separated usernames" className="h-8 text-sm bg-muted/40 border-border" />
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm text-muted-foreground w-20 shrink-0">Groups:</label>
              <Input value={editGroups} onChange={e => setEditGroups(e.target.value)}
                placeholder="Comma-separated groups" className="h-8 text-sm bg-muted/40 border-border" />
            </div>
            <p className="text-[11px] text-primary ml-24">Edit permissions also grant viewing permissions</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────
function CorrespondentModal({
  mode, initial, onSave, onClose,
}: {
  mode: 'create' | 'edit';
  initial?: Correspondent;
  onSave: (data: Omit<Correspondent, 'id' | 'docCount' | 'lastUsed'>) => Promise<void>;
  onClose: () => void;
}) {
  const { currentUser, userProfile } = useAuth();
  const [name, setName] = useState(initial?.name || '');
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
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        matching,
        matchText: matchText.trim(),
        ownerName: ownerName.trim(),
        ownerId: currentUser?.uid,
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-16 pb-8 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-400/10 flex items-center justify-center">
              <Users size={16} className="text-blue-400" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {mode === 'create' ? 'Create new correspondent' : 'Edit correspondent'}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Name <span className="text-destructive">*</span></label>
            <Input value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="e.g. Acme Corp, National Revenue Board..."
              autoFocus
              className="h-9 text-sm bg-muted/40 border-border focus-visible:ring-primary" />
          </div>

          {/* Matching */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Matching algorithm</label>
            <MatchingSelect value={matching} onChange={setMatching} />
            {matching !== 'auto' && matching !== 'none' && (
              <Input value={matchText} onChange={e => setMatchText(e.target.value)}
                placeholder="Enter matching pattern / keywords..."
                className="h-9 text-sm bg-muted/40 border-border mt-2" />
            )}
            {matching === 'auto' && (
              <p className="text-[11px] text-muted-foreground">The system will learn to match this correspondent automatically from document content.</p>
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
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="px-5 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
            {saving ? <><Loader2 size={13} className="animate-spin" /> Saving...</> : <><Check size={13} /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Correspondents() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Correspondent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<Correspondent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Correspondent | null>(null);

  // ── Fetch ──
  const fetchAll = async () => {
    setLoading(true);

    // 1. Load managed correspondents from Firestore
    const managed: Record<string, Correspondent> = {};
    try {
      const snap = await getDocs(collection(db, 'correspondents'));
      snap.forEach(d => {
        const data = d.data();
        managed[data.name] = { id: d.id, name: data.name, matching: data.matching || 'auto', matchText: data.matchText || '', ownerName: data.ownerName, ownerId: data.ownerId, viewUsers: data.viewUsers || [], viewGroups: data.viewGroups || [], editUsers: data.editUsers || [], editGroups: data.editGroups || [], createdAt: data.createdAt, docCount: 0 };
      });
    } catch {}

    // 2. Count documents per client name
    const docCounts: Record<string, number> = {};
    const lastUsed: Record<string, string> = {};

    const processDoc = (d: any) => {
      if (d.isDeleted || !d.client) return;
      docCounts[d.client] = (docCounts[d.client] || 0) + 1;
      const date = d.date || d.createdAt?.slice(0, 10) || '';
      if (!lastUsed[d.client] || date > lastUsed[d.client]) lastUsed[d.client] = date;
      // Auto-create entry if not in managed
      if (!managed[d.client]) {
        managed[d.client] = { id: `auto_${d.client}`, name: d.client, matching: 'auto', docCount: 0 };
      }
    };

    try {
      const snap = await getDocs(collection(db, 'documents'));
      snap.forEach(d => processDoc(d.data()));
    } catch {}
    try {
      const local = JSON.parse(localStorage.getItem('local_documents') || '[]');
      local.forEach(processDoc);
    } catch {}

    // Merge counts
    const result = Object.values(managed).map(c => ({
      ...c,
      docCount: docCounts[c.name] || 0,
      lastUsed: lastUsed[c.name] || '',
    })).sort((a, b) => (b.docCount || 0) - (a.docCount || 0));

    setItems(result);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ── CRUD ──
  const handleCreate = async (data: Omit<Correspondent, 'id' | 'docCount' | 'lastUsed'>) => {
    if (items.find(i => i.name.toLowerCase() === data.name.toLowerCase())) {
      toast.error('A correspondent with this name already exists');
      throw new Error('duplicate');
    }
    try {
      await addDoc(collection(db, 'correspondents'), data);
      toast.success(`Correspondent "${data.name}" created`);
    } catch {
      toast.success(`Correspondent "${data.name}" created (locally)`);
    }
    fetchAll();
  };

  const handleEdit = async (data: Omit<Correspondent, 'id' | 'docCount' | 'lastUsed'>) => {
    if (!editTarget) return;
    if (!editTarget.id.startsWith('auto_')) {
      try { await updateDoc(doc(db, 'correspondents', editTarget.id), data as any); } catch {}
    } else {
      // Promote from auto to managed
      try { await addDoc(collection(db, 'correspondents'), data); } catch {}
    }
    toast.success(`Correspondent "${data.name}" updated`);
    fetchAll();
  };

  const handleDelete = async (item: Correspondent) => {
    if (!item.id.startsWith('auto_')) {
      try { await deleteDoc(doc(db, 'correspondents', item.id)); } catch {}
    }
    setItems(prev => prev.filter(i => i.id !== item.id));
    setDeleteTarget(null);
    toast.success(`Correspondent "${item.name}" deleted`);
  };

  const handleBulkDelete = async () => {
    for (const id of selected) {
      const item = items.find(i => i.id === id);
      if (item && !item.id.startsWith('auto_')) {
        try { await deleteDoc(doc(db, 'correspondents', item.id)); } catch {}
      }
    }
    setItems(prev => prev.filter(i => !selected.has(i.id)));
    toast.success(`${selected.size} correspondent${selected.size > 1 ? 's' : ''} deleted`);
    setSelected(new Set());
  };

  // ── Filtered + paginated ──
  const filtered = items.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(prev => prev.size === paginated.length ? new Set() : new Set(paginated.map(i => i.id)));

  const matchingLabel = (m: string) => MATCHING_ALGORITHMS.find(a => a.value === m)?.label.split(':')[0] || m;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-400/10 flex items-center justify-center">
            <Users size={18} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Correspondents</h1>
            <p className="text-xs text-muted-foreground">Clients and organizations linked to documents</p>
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

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <span className="text-xs text-muted-foreground shrink-0">Filter by:</span>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Name" className="pl-7 h-8 text-xs w-52 bg-muted/40 border-border" />
        </div>
        {search && (
          <button onClick={() => setSearch('')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <X size={11} /> Clear
          </button>
        )}
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-1 rounded hover:bg-muted/50 disabled:opacity-30 transition-colors"><ChevronLeft size={13} /></button>
            <span>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="p-1 rounded hover:bg-muted/50 disabled:opacity-30 transition-colors"><ChevronRight size={13} /></button>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Building2 size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No correspondents found</p>
            <p className="text-xs text-muted-foreground mb-4">
              {search ? 'Try a different search.' : 'Create your first correspondent or upload documents with client names.'}
            </p>
            {!search && (
              <button onClick={() => setShowModal('create')}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors">
                <Plus size={14} /> Create correspondent
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={selected.size === paginated.length && paginated.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-border bg-muted/40 accent-primary cursor-pointer" />
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Matching</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Document count</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last used</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map(c => (
                <tr key={c.id} className={`group hover:bg-muted/20 transition-colors ${selected.has(c.id) ? 'bg-primary/5' : ''}`}>
                  <td className="w-10 px-4 py-3">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                      className="w-4 h-4 rounded border-border bg-muted/40 accent-primary cursor-pointer" />
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/documents?client=${encodeURIComponent(c.name)}`)}
                      className="flex items-center gap-2.5 hover:text-primary transition-colors text-left">
                      <div className="w-8 h-8 rounded-lg bg-blue-400/15 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground group-hover:text-primary transition-colors">{c.name}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                      {matchingLabel(c.matching || 'auto')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <FileText size={12} className="text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{c.docCount ?? 0}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {c.lastUsed || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditTarget(c); setShowModal('edit'); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Status bar ── */}
      {!loading && filtered.length > 0 && (
        <div className="px-6 py-2 border-t border-border shrink-0 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filtered.length} correspondent{filtered.length !== 1 ? 's' : ''}
            {selected.size > 0 && <span className="text-primary ml-2">· {selected.size} selected</span>}
          </p>
        </div>
      )}

      {/* ── Modals ── */}
      {(showModal === 'create' || showModal === 'edit') && (
        <CorrespondentModal
          mode={showModal}
          initial={showModal === 'edit' ? editTarget ?? undefined : undefined}
          onSave={showModal === 'create' ? handleCreate : handleEdit}
          onClose={() => { setShowModal(null); setEditTarget(null); }}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          name={deleteTarget.name}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
