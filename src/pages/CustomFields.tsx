import React, { useState, useEffect } from 'react';
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '@/firebase';
import {
  SlidersHorizontal, Plus, Pencil, Trash2, X, Check,
  AlertCircle, Loader2, Hash, Calendar, ToggleLeft,
  DollarSign, Link, FileText, Type, AlignLeft,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
type DataType = 'boolean' | 'date' | 'integer' | 'number' | 'monetary' | 'text' | 'url' | 'select' | 'document_link';

interface CustomField {
  id: string;
  name: string;
  dataType: DataType;
  selectOptions?: string[]; // for 'select' type
  createdAt?: string;
  usageCount?: number;
}

const DATA_TYPES: { value: DataType; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'boolean',       label: 'Boolean',       description: 'True / False checkbox',               icon: ToggleLeft   },
  { value: 'date',          label: 'Date',           description: 'Calendar date picker',                icon: Calendar     },
  { value: 'integer',       label: 'Integer',        description: 'Whole numbers (1, 2, 3…)',            icon: Hash         },
  { value: 'number',        label: 'Number',         description: 'Decimal numbers (1.5, 3.14…)',        icon: Hash         },
  { value: 'monetary',      label: 'Monetary',       description: 'Currency amount (BDT, USD…)',         icon: DollarSign   },
  { value: 'text',          label: 'Text',           description: 'Short single-line text',              icon: Type         },
  { value: 'url',           label: 'URL',            description: 'Web address / link',                  icon: Link         },
  { value: 'select',        label: 'Select',         description: 'Dropdown with predefined options',    icon: AlignLeft    },
  { value: 'document_link', label: 'Document link',  description: 'Reference to another document',       icon: FileText     },
];

const typeColor: Record<DataType, string> = {
  boolean:       'bg-emerald-400/15 text-emerald-400 border-emerald-400/30',
  date:          'bg-blue-400/15 text-blue-400 border-blue-400/30',
  integer:       'bg-violet-400/15 text-violet-400 border-violet-400/30',
  number:        'bg-violet-400/15 text-violet-400 border-violet-400/30',
  monetary:      'bg-yellow-400/15 text-yellow-400 border-yellow-400/30',
  text:          'bg-primary/15 text-primary border-primary/30',
  url:           'bg-cyan-400/15 text-cyan-400 border-cyan-400/30',
  select:        'bg-pink-400/15 text-pink-400 border-pink-400/30',
  document_link: 'bg-orange-400/15 text-orange-400 border-orange-400/30',
};

// ─── Data Type Picker ─────────────────────────────────────────────────────────
function DataTypePicker({ value, onChange }: { value: DataType; onChange: (v: DataType) => void }) {
  const [open, setOpen] = useState(false);
  const current = DATA_TYPES.find(d => d.value === value) ?? DATA_TYPES[5];
  const CurrentIcon = current.icon;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 h-9 px-3 bg-muted/40 border border-border rounded-lg text-sm text-foreground hover:border-primary/50 transition-colors">
        <CurrentIcon size={14} className="text-muted-foreground shrink-0" />
        <span className="flex-1 text-left">{current.label}</span>
        <X size={10} className={`text-muted-foreground transition-transform ${open ? 'rotate-45' : 'rotate-0 opacity-0'}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden py-1 max-h-72 overflow-y-auto">
            {DATA_TYPES.map(dt => {
              const Icon = dt.icon;
              return (
                <button key={dt.value} type="button"
                  onClick={() => { onChange(dt.value); setOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                    value === dt.value ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted/60'
                  }`}>
                  <Icon size={14} className="shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{dt.label}</span>
                    <span className="text-[11px] text-muted-foreground ml-2">{dt.description}</span>
                  </div>
                  {value === dt.value && <Check size={12} className="shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </>
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
            <p className="text-sm font-semibold text-foreground">Delete custom field?</p>
            <p className="text-xs text-muted-foreground mt-0.5">This will remove the field from all documents.</p>
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
function FieldModal({ mode, initial, onSave, onClose }: {
  mode: 'create' | 'edit';
  initial?: CustomField;
  onSave: (data: Omit<CustomField, 'id' | 'usageCount'>) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [dataType, setDataType] = useState<DataType>(initial?.dataType || 'text');
  const [selectOpts, setSelectOpts] = useState((initial?.selectOptions || []).join('\n'));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Field name is required'); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        dataType,
        selectOptions: dataType === 'select' ? selectOpts.split('\n').map(s => s.trim()).filter(Boolean) : [],
        createdAt: initial?.createdAt || new Date().toISOString(),
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-16 pb-8 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <SlidersHorizontal size={16} className="text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {mode === 'create' ? 'Create new custom field' : 'Edit custom field'}
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
            <label className="text-sm font-medium text-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <Input value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="e.g. Contract Value, Due Date, Signed By..."
              autoFocus
              className="h-9 text-sm bg-muted/40 border-border focus-visible:ring-primary" />
          </div>

          {/* Data Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Data type</label>
            <DataTypePicker value={dataType} onChange={setDataType} />
            {/* disabled for edit */}
            {mode === 'edit' && (
              <p className="text-[11px] text-amber-400 flex items-center gap-1">
                <AlertCircle size={10} /> Data type cannot be changed after creation.
              </p>
            )}
          </div>

          {/* Select options (only for 'select' type) */}
          {dataType === 'select' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Options</label>
              <textarea
                value={selectOpts}
                onChange={e => setSelectOpts(e.target.value)}
                placeholder={"Option A\nOption B\nOption C"}
                rows={4}
                className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-[11px] text-muted-foreground">One option per line</p>
            </div>
          )}

          {/* Preview */}
          {name && (
            <div className="bg-muted/20 border border-border rounded-xl p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Preview on document</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-28 shrink-0">{name}</span>
                <div className="flex-1">
                  {dataType === 'boolean' && (
                    <div className="w-9 h-5 bg-primary/30 rounded-full flex items-center px-1"><div className="w-3 h-3 bg-primary rounded-full" /></div>
                  )}
                  {dataType === 'date' && (
                    <div className="h-7 px-2 bg-muted/60 border border-border rounded text-xs text-muted-foreground flex items-center gap-1.5"><Calendar size={11} /> 2026-06-22</div>
                  )}
                  {(dataType === 'integer' || dataType === 'number') && (
                    <div className="h-7 px-2 bg-muted/60 border border-border rounded text-xs text-muted-foreground flex items-center"><Hash size={11} className="mr-1" /> 0</div>
                  )}
                  {dataType === 'monetary' && (
                    <div className="h-7 px-2 bg-muted/60 border border-border rounded text-xs text-muted-foreground flex items-center"><span className="mr-1 text-[10px]">BDT</span> 0.00</div>
                  )}
                  {dataType === 'text' && (
                    <div className="h-7 px-2 bg-muted/60 border border-border rounded text-xs text-muted-foreground flex items-center">Enter text…</div>
                  )}
                  {dataType === 'url' && (
                    <div className="h-7 px-2 bg-muted/60 border border-border rounded text-xs text-cyan-400 flex items-center"><Link size={11} className="mr-1" /> https://</div>
                  )}
                  {dataType === 'select' && (
                    <div className="h-7 px-2 bg-muted/60 border border-border rounded text-xs text-muted-foreground flex items-center justify-between">
                      <span>{selectOpts.split('\n').filter(Boolean)[0] || 'Select…'}</span>
                      <X size={8} className="rotate-45 text-muted-foreground/50" />
                    </div>
                  )}
                  {dataType === 'document_link' && (
                    <div className="h-7 px-2 bg-muted/60 border border-border rounded text-xs text-orange-400 flex items-center gap-1"><FileText size={11} /> Link a document…</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="px-5 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
            {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Check size={13} /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomFields() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<CustomField | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomField | null>(null);

  const fetchFields = async () => {
    setLoading(true);
    const result: CustomField[] = [];
    try {
      const snap = await getDocs(collection(db, 'customFields'));
      snap.forEach(d => {
        const data = d.data();
        result.push({ id: d.id, name: data.name, dataType: data.dataType || 'text', selectOptions: data.selectOptions || [], createdAt: data.createdAt });
      });
    } catch {}
    // localStorage fallback
    try {
      const local: CustomField[] = JSON.parse(localStorage.getItem('local_customFields') || '[]');
      local.forEach(f => { if (!result.find(r => r.id === f.id)) result.push(f); });
    } catch {}
    setFields(result.sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  };

  useEffect(() => { fetchFields(); }, []);

  const handleCreate = async (data: Omit<CustomField, 'id' | 'usageCount'>) => {
    if (fields.find(f => f.name.toLowerCase() === data.name.toLowerCase())) {
      toast.error('A field with this name already exists'); throw new Error('dup');
    }
    try {
      await addDoc(collection(db, 'customFields'), data);
      toast.success(`Field "${data.name}" created`);
    } catch {
      // local fallback
      const id = `local_${Date.now()}`;
      const local: CustomField[] = JSON.parse(localStorage.getItem('local_customFields') || '[]');
      local.push({ ...data, id });
      localStorage.setItem('local_customFields', JSON.stringify(local));
      toast.success(`Field "${data.name}" created (locally)`);
    }
    fetchFields();
  };

  const handleEdit = async (data: Omit<CustomField, 'id' | 'usageCount'>) => {
    if (!editTarget) return;
    try {
      await updateDoc(doc(db, 'customFields', editTarget.id), data as any);
    } catch {
      const local: CustomField[] = JSON.parse(localStorage.getItem('local_customFields') || '[]');
      const idx = local.findIndex(f => f.id === editTarget.id);
      if (idx >= 0) { local[idx] = { ...local[idx], ...data }; localStorage.setItem('local_customFields', JSON.stringify(local)); }
    }
    toast.success(`Field "${data.name}" updated`);
    fetchFields();
  };

  const handleDelete = async (field: CustomField) => {
    try { await deleteDoc(doc(db, 'customFields', field.id)); } catch {}
    try {
      const local: CustomField[] = JSON.parse(localStorage.getItem('local_customFields') || '[]');
      localStorage.setItem('local_customFields', JSON.stringify(local.filter(f => f.id !== field.id)));
    } catch {}
    setFields(prev => prev.filter(f => f.id !== field.id));
    setDeleteTarget(null);
    toast.success(`Field "${field.name}" deleted`);
  };

  const getTypeInfo = (dt: DataType) => DATA_TYPES.find(d => d.value === dt) ?? DATA_TYPES[5];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <SlidersHorizontal size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Custom Fields</h1>
            <p className="text-xs text-muted-foreground">Add extra metadata fields to your documents</p>
          </div>
        </div>
        <button onClick={() => { setShowModal('create'); setEditTarget(null); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors">
          <Plus size={15} /> Add field
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : fields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <SlidersHorizontal size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No fields defined.</p>
            <p className="text-xs text-muted-foreground mb-4">Create custom fields to store extra metadata on your documents.</p>
            <button onClick={() => setShowModal('create')}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors">
              <Plus size={14} /> Add field
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data type</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Options / Info</th>
                <th className="text-right px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fields.map(field => {
                const typeInfo = getTypeInfo(field.dataType);
                const TypeIcon = typeInfo.icon;
                return (
                  <tr key={field.id} className="group hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-3">
                      <span className="font-medium text-foreground">{field.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${typeColor[field.dataType]}`}>
                        <TypeIcon size={11} />
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {field.dataType === 'select' && field.selectOptions && field.selectOptions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {field.selectOptions.slice(0, 4).map(o => (
                            <span key={o} className="px-1.5 py-0.5 bg-muted rounded text-[10px]">{o}</span>
                          ))}
                          {field.selectOptions.length > 4 && <span className="text-[10px] text-muted-foreground">+{field.selectOptions.length - 4} more</span>}
                        </div>
                      ) : (
                        <span>{typeInfo.description}</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditTarget(field); setShowModal('edit'); }}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDeleteTarget(field)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Status */}
      {!loading && fields.length > 0 && (
        <div className="px-6 py-2 border-t border-border shrink-0">
          <p className="text-xs text-muted-foreground">{fields.length} custom field{fields.length !== 1 ? 's' : ''}</p>
        </div>
      )}

      {/* Modals */}
      {(showModal === 'create' || showModal === 'edit') && (
        <FieldModal
          mode={showModal}
          initial={showModal === 'edit' ? editTarget ?? undefined : undefined}
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
