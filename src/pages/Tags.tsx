import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { Tag, Plus, X, Pencil, Check, Hash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface TagItem {
  id: string;
  name: string;
  color: string;
  docCount?: number;
}

const PRESET_COLORS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
];

export default function Tags() {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const fetchTags = async () => {
    setLoading(true);
    const result: TagItem[] = [];
    const tagCounts: Record<string, number> = {};

    // Read all tags from documents
    try {
      const snap = await getDocs(collection(db, 'documents'));
      snap.forEach(d => {
        const data = d.data();
        if (Array.isArray(data.tags)) {
          data.tags.forEach((t: string) => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
        }
      });
    } catch {}
    try {
      const local = JSON.parse(localStorage.getItem('local_documents') || '[]');
      local.forEach((d: any) => {
        if (Array.isArray(d.tags)) {
          d.tags.forEach((t: string) => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
        }
      });
    } catch {}

    // Try to load from tags collection (managed tags)
    const managedColors: Record<string, string> = {};
    const managedIds: Record<string, string> = {};
    try {
      const snap = await getDocs(collection(db, 'tags'));
      snap.forEach(d => {
        const data = d.data();
        managedColors[data.name] = data.color || PRESET_COLORS[0];
        managedIds[data.name] = d.id;
      });
    } catch {}

    // Merge
    const allTagNames = new Set([...Object.keys(tagCounts), ...Object.keys(managedColors)]);
    allTagNames.forEach(name => {
      result.push({
        id: managedIds[name] || `auto_${name}`,
        name,
        color: managedColors[name] || PRESET_COLORS[Math.abs(name.charCodeAt(0)) % PRESET_COLORS.length],
        docCount: tagCounts[name] || 0,
      });
    });

    setTags(result.sort((a, b) => (b.docCount || 0) - (a.docCount || 0)));
    setLoading(false);
  };

  useEffect(() => { fetchTags(); }, []);

  const addTag = async () => {
    const name = newName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name) return;
    if (tags.find(t => t.name === name)) { toast.error('Tag already exists'); return; }
    try {
      await addDoc(collection(db, 'tags'), { name, color: newColor, createdAt: new Date().toISOString() });
      toast.success(`Tag "#${name}" created`);
      setNewName('');
      fetchTags();
    } catch {
      // local fallback
      setTags(prev => [...prev, { id: `local_${Date.now()}`, name, color: newColor, docCount: 0 }]);
      setNewName('');
    }
  };

  const deleteTag = async (t: TagItem) => {
    if (!t.id.startsWith('auto_') && !t.id.startsWith('local_')) {
      try { await deleteDoc(doc(db, 'tags', t.id)); } catch {}
    }
    setTags(prev => prev.filter(x => x.id !== t.id));
    toast.success(`Tag "#${t.name}" deleted`);
  };

  const saveEdit = async (t: TagItem) => {
    const newTagName = editName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!newTagName) return;
    if (!t.id.startsWith('auto_') && !t.id.startsWith('local_')) {
      try { await updateDoc(doc(db, 'tags', t.id), { name: newTagName }); } catch {}
    }
    setTags(prev => prev.map(x => x.id === t.id ? { ...x, name: newTagName } : x));
    setEditId(null);
    toast.success('Tag updated');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Tag size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Tags</h1>
          <p className="text-sm text-muted-foreground">Manage document tags for organization and quick filtering</p>
        </div>
      </div>

      {/* Add new */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Create New Tag</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${newColor === c ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-card' : 'hover:scale-110'}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Hash size={13} className="text-muted-foreground" />
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              placeholder="tag-name"
              className="h-8 text-sm bg-muted/40 border-border max-w-xs"
            />
          </div>
          <button onClick={addTag} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus size={13} /> Create
          </button>
        </div>
        {newName && (
          <div className="mt-3">
            <p className="text-[10px] text-muted-foreground mb-1">Preview:</p>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border" style={{ color: newColor, background: `${newColor}20`, borderColor: `${newColor}50` }}>
              #{newName}
            </span>
          </div>
        )}
      </div>

      {/* Tags list */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading tags...</p>
      ) : tags.length === 0 ? (
        <div className="text-center py-12">
          <Tag size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No tags yet. Create one or upload documents with tags.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2 border-b border-border bg-muted/30">
            <span className="col-span-1">Color</span>
            <span className="col-span-6">Name</span>
            <span className="col-span-3">Documents</span>
            <span className="col-span-2 text-right">Actions</span>
          </div>
          <div className="divide-y divide-border">
            {tags.map(t => (
              <div key={t.id} className="grid grid-cols-12 items-center px-4 py-2.5 hover:bg-muted/20 transition-colors">
                <div className="col-span-1">
                  <div className="w-4 h-4 rounded-full" style={{ background: t.color }} />
                </div>
                <div className="col-span-6">
                  {editId === t.id ? (
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit(t)}
                      autoFocus
                      className="h-7 text-xs bg-muted/40 border-border max-w-[200px]"
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border"
                      style={{ color: t.color, background: `${t.color}15`, borderColor: `${t.color}40` }}>
                      #{t.name}
                    </span>
                  )}
                </div>
                <div className="col-span-3">
                  <span className="text-sm font-medium text-foreground">{t.docCount}</span>
                  <span className="text-xs text-muted-foreground ml-1">doc{t.docCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  {editId === t.id ? (
                    <button onClick={() => saveEdit(t)} className="p-1 text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors"><Check size={13} /></button>
                  ) : (
                    <button onClick={() => { setEditId(t.id); setEditName(t.name); }} className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"><Pencil size={12} /></button>
                  )}
                  <button onClick={() => deleteTag(t)} className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"><X size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
