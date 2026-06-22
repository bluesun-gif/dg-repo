import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { Trash2, RotateCcw, X, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface TrashedDoc {
  id: string;
  name: string;
  originalName?: string;
  deletedAt?: string;
  client?: string;
  category?: string;
  size?: string;
  isLocal?: boolean;
}

export default function Trash() {
  const [docs, setDocs] = useState<TrashedDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const result: TrashedDoc[] = [];

    try {
      const snap = await getDocs(collection(db, 'documents'));
      snap.forEach(d => {
        const data = d.data();
        if (data.isDeleted) result.push({ id: d.id, ...data as TrashedDoc });
      });
    } catch {}

    try {
      const local = JSON.parse(localStorage.getItem('local_documents') || '[]');
      local.forEach((d: any) => {
        if (d.isDeleted) result.push({ ...d, isLocal: true });
      });
    } catch {}

    result.sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
    setDocs(result);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const restore = async (d: TrashedDoc) => {
    try {
      if (!d.isLocal) {
        await updateDoc(doc(db, 'documents', d.id), { isDeleted: false, deletedAt: null });
      } else {
        const local = JSON.parse(localStorage.getItem('local_documents') || '[]');
        const idx = local.findIndex((x: any) => x.id === d.id);
        if (idx !== -1) { local[idx].isDeleted = false; delete local[idx].deletedAt; localStorage.setItem('local_documents', JSON.stringify(local)); }
      }
      toast.success(`"${d.originalName || d.name}" restored`);
      fetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const permanentDelete = async (d: TrashedDoc) => {
    if (!confirm(`Permanently delete "${d.originalName || d.name}"? This cannot be undone.`)) return;
    try {
      if (!d.isLocal) {
        await deleteDoc(doc(db, 'documents', d.id));
      } else {
        const local = JSON.parse(localStorage.getItem('local_documents') || '[]');
        localStorage.setItem('local_documents', JSON.stringify(local.filter((x: any) => x.id !== d.id)));
      }
      toast.success('Permanently deleted');
      fetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const emptyTrash = async () => {
    if (!confirm(`Permanently delete all ${docs.length} items in Trash? This cannot be undone.`)) return;
    await Promise.all(docs.map(d => permanentDelete(d)));
    toast.success('Trash emptied');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Trash2 size={18} className="text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Trash</h1>
            <p className="text-sm text-muted-foreground">{docs.length} deleted document{docs.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {docs.length > 0 && (
          <button onClick={emptyTrash} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors">
            <Trash2 size={13} /> Empty Trash
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
      ) : docs.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Trash2 size={28} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Trash is empty</h3>
          <p className="text-sm text-muted-foreground">Deleted documents will appear here. You can restore or permanently delete them.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2 border-b border-border bg-muted/30">
            <span className="col-span-5">Document</span>
            <span className="col-span-3">Client · Type</span>
            <span className="col-span-2">Deleted</span>
            <span className="col-span-2 text-right">Actions</span>
          </div>
          <div className="divide-y divide-border">
            {docs.map(d => (
              <div key={d.id} className="grid grid-cols-12 items-center px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="col-span-5 flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded bg-destructive/10 flex items-center justify-center shrink-0">
                    <FileText size={13} className="text-destructive" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{d.originalName || d.name}</p>
                    {d.size && <p className="text-[10px] text-muted-foreground">{d.size}</p>}
                  </div>
                </div>
                <div className="col-span-3">
                  <p className="text-xs text-muted-foreground">{d.client && <span className="text-blue-400">{d.client}</span>}</p>
                  {d.category && <p className="text-[10px] text-muted-foreground">{d.category}</p>}
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">{d.deletedAt?.slice(0, 10) || '—'}</p>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <button onClick={() => restore(d)} title="Restore" className="p-1.5 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors">
                    <RotateCcw size={13} />
                  </button>
                  <button onClick={() => permanentDelete(d)} title="Delete permanently" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
