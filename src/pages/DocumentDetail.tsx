import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { renderPdfPage } from '@/hooks/usePdfThumbnail';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Trash2, Download,
  X, Save, RotateCcw, FileText, Tag, User, Shield, Clock,
  FileSearch, Plus, Check, Pencil, Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DocData {
  id: string;
  name: string;
  originalName?: string;
  dept?: string;
  client?: string;
  category?: string;
  version?: string;
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
  storageType?: string;
}

type TabId = 'details' | 'content' | 'metadata' | 'notes' | 'history' | 'permissions';

const DEPARTMENTS = ['Sales', 'Technical', 'Finance', 'Legal', 'HR', 'Operations', 'Other'];
const CATEGORIES = ['Technical Proposal', 'Financial Proposal', 'Contract', 'RFP', 'Architecture', 'Report', 'Invoice', 'Other'];
const CONFIDENTIALITIES = ['Public', 'Internal', 'Confidential', 'Restricted'];

function getDocFromLocal(id: string): DocData | null {
  try {
    const all = JSON.parse(localStorage.getItem('local_documents') || '[]');
    return all.find((d: any) => d.id === id) || null;
  } catch { return null; }
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [doc_, setDoc_] = useState<DocData | null>(null);
  const [editedDoc, setEditedDoc] = useState<DocData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('details');
  const [isDirty, setIsDirty] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [newTag, setNewTag] = useState('');

  // PDF viewer state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');

  // ── Load document ──
  useEffect(() => {
    if (!id) return;
    setLoading(true);

    (async () => {
      let found: DocData | null = null;

      // Try Firestore first
      if (!id.startsWith('local_')) {
        try {
          const snap = await getDoc(doc(db, 'documents', id));
          if (snap.exists()) found = { id: snap.id, ...snap.data() } as DocData;
        } catch {}
      }

      // Fall back to localStorage
      if (!found) found = getDocFromLocal(id);

      setDoc_(found);
      setEditedDoc(found ? { ...found } : null);
      setLoading(false);
    })();
  }, [id]);

  // ── Render PDF page ──
  const renderPage = useCallback(async (pageNum: number, pageScale: number) => {
    if (!editedDoc?.fileUrl || editedDoc.fileUrl === '[local]' || !canvasRef.current) return;
    const isPdf = editedDoc.fileUrl.includes('application/pdf') ||
      editedDoc.fileUrl.toLowerCase().endsWith('.pdf') ||
      (editedDoc.fileUrl.startsWith('data:') && editedDoc.fileUrl.includes('pdf'));
    if (!isPdf) return;

    setPdfLoading(true);
    setPdfError('');
    try {
      const total = await renderPdfPage(editedDoc.fileUrl, pageNum, canvasRef.current, pageScale);
      setTotalPages(total);
    } catch (e: any) {
      setPdfError(e.message);
    } finally {
      setPdfLoading(false);
    }
  }, [editedDoc?.fileUrl]);

  useEffect(() => {
    if (editedDoc?.fileUrl) renderPage(currentPage, scale);
  }, [editedDoc?.fileUrl, currentPage, scale]);

  const update = (field: keyof DocData, value: any) => {
    setEditedDoc(prev => prev ? { ...prev, [field]: value } : prev);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!editedDoc) return;
    setSaving(true);
    try {
      if (!id?.startsWith('local_')) {
        await updateDoc(doc(db, 'documents', id!), {
          client: editedDoc.client,
          category: editedDoc.category,
          dept: editedDoc.dept,
          tags: editedDoc.tags,
          confidentiality: editedDoc.confidentiality,
          summary: editedDoc.summary,
          version: editedDoc.version,
        });
      }
      // Also update localStorage
      const local = JSON.parse(localStorage.getItem('local_documents') || '[]');
      const idx = local.findIndex((d: any) => d.id === id);
      if (idx !== -1) {
        local[idx] = { ...local[idx], ...editedDoc };
        localStorage.setItem('local_documents', JSON.stringify(local));
      }
      setDoc_(editedDoc);
      setIsDirty(false);
      toast.success('Document saved');
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setEditedDoc(doc_ ? { ...doc_ } : null);
    setIsDirty(false);
  };

  const handleDelete = async () => {
    if (!confirm('Move this document to Trash?')) return;
    try {
      if (!id?.startsWith('local_')) {
        await updateDoc(doc(db, 'documents', id!), { isDeleted: true, deletedAt: new Date().toISOString() });
      }
      const local = JSON.parse(localStorage.getItem('local_documents') || '[]');
      const idx = local.findIndex((d: any) => d.id === id);
      if (idx !== -1) { local[idx].isDeleted = true; localStorage.setItem('local_documents', JSON.stringify(local)); }
      toast.success('Moved to Trash');
      navigate('/documents');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDownload = () => {
    if (!editedDoc?.fileUrl || editedDoc.fileUrl === '[local]') { toast.error('File not available for download'); return; }
    const a = document.createElement('a');
    a.href = editedDoc.fileUrl;
    a.download = editedDoc.originalName || editedDoc.name;
    a.click();
  };

  const addTag = () => {
    const t = newTag.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !editedDoc?.tags?.includes(t)) {
      update('tags', [...(editedDoc?.tags || []), t]);
    }
    setNewTag('');
  };
  const removeTag = (t: string) => update('tags', (editedDoc?.tags || []).filter(x => x !== t));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading document...</p>
        </div>
      </div>
    );
  }

  if (!editedDoc) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <FileText size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-base font-semibold text-foreground">Document not found</p>
          <button onClick={() => navigate('/documents')} className="mt-3 text-sm text-primary hover:underline">
            ← Back to Documents
          </button>
        </div>
      </div>
    );
  }

  const ext = (editedDoc.originalName || editedDoc.name).split('.').pop()?.toLowerCase() || '';
  const isPdf = ext === 'pdf';
  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
  const isDocx = ['docx', 'doc'].includes(ext);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'content', label: 'Content' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'notes', label: 'Notes' },
    { id: 'history', label: 'History' },
    { id: 'permissions', label: 'Permissions' },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Top action bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/documents')} className="p-1.5 hover:bg-muted rounded transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
          {isPdf && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="p-1.5 hover:bg-muted rounded disabled:opacity-40 transition-colors">
                <ChevronLeft size={15} className="text-muted-foreground" />
              </button>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>Page</span>
                <input
                  type="number" min={1} max={totalPages || 1} value={currentPage}
                  onChange={e => setCurrentPage(Math.max(1, Math.min(totalPages, +e.target.value)))}
                  className="w-10 text-center bg-muted border border-border rounded text-foreground text-xs px-1 py-0.5"
                />
                <span>of {totalPages || '?'}</span>
              </div>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-1.5 hover:bg-muted rounded disabled:opacity-40 transition-colors">
                <ChevronRight size={15} className="text-muted-foreground" />
              </button>
              <div className="w-px h-5 bg-border mx-1" />
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1.5 hover:bg-muted rounded transition-colors" title="Zoom out">
                <ZoomOut size={14} className="text-muted-foreground" />
              </button>
              <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-1.5 hover:bg-muted rounded transition-colors" title="Zoom in">
                <ZoomIn size={14} className="text-muted-foreground" />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <>
              <button onClick={handleDiscard} className="px-3 py-1.5 text-xs text-muted-foreground border border-border rounded hover:bg-muted transition-colors">
                Discard
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted text-foreground border border-border rounded hover:bg-muted/80 transition-colors">
                Save & close
              </button>
            </>
          )}
          <button onClick={handleSave} disabled={saving || !isDirty} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : <><Check size={12} /> Save</>}
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-destructive border border-destructive/30 rounded hover:bg-destructive/10 transition-colors">
            <Trash2 size={12} /> Delete
          </button>
          <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary/90 transition-colors">
            <Download size={12} /> Download
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left: Tabs panel ── */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col bg-card">
          {/* Doc title */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-bold text-foreground font-mono">
              {editedDoc.name.split('_').slice(0, 3).join(' · ')}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{editedDoc.originalName || editedDoc.name}</p>
          </div>

          {/* Tab nav */}
          <div className="flex border-b border-border">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 py-2 text-[10px] font-semibold transition-colors border-b-2 ${
                  activeTab === t.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* ── Details tab ── */}
            {activeTab === 'details' && (
              <div className="space-y-4">
                <Field label="Title">
                  <Input value={editedDoc.name} onChange={e => update('name', e.target.value)}
                    className="h-8 text-xs bg-muted/40 border-border" />
                </Field>
                <Field label="Date created">
                  <Input type="date" value={editedDoc.date || ''} onChange={e => update('date', e.target.value)}
                    className="h-8 text-xs bg-muted/40 border-border" />
                </Field>
                <Field label="Correspondent / Client">
                  <div className="flex gap-1">
                    <Input value={editedDoc.client || ''} onChange={e => update('client', e.target.value)}
                      placeholder="Client name" className="h-8 text-xs bg-muted/40 border-border flex-1" />
                    <button className="w-7 h-8 flex items-center justify-center bg-muted border border-border rounded text-muted-foreground hover:text-foreground transition-colors">
                      <Plus size={12} />
                    </button>
                  </div>
                </Field>
                <Field label="Document Type">
                  <Select value={editedDoc.category || ''} onValueChange={v => update('category', v)}>
                    <SelectTrigger className="h-8 text-xs bg-muted/40 border-border">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tags">
                  <div className="space-y-1.5">
                    {(editedDoc.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(editedDoc.tags || []).map(t => (
                          <span key={t} className="flex items-center gap-0.5 px-2 py-0.5 bg-primary/15 text-primary border border-primary/30 rounded-full text-[10px]">
                            #{t}
                            <button onClick={() => removeTag(t)} className="hover:text-destructive ml-0.5"><X size={9} /></button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1">
                      <Input value={newTag} onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        placeholder="Add tag..." className="h-7 text-xs bg-muted/40 border-border" />
                      <button onClick={addTag} className="w-7 h-7 flex items-center justify-center bg-muted border border-border rounded text-muted-foreground hover:text-foreground transition-colors">
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                </Field>
                <Field label="Confidentiality">
                  <Select value={editedDoc.confidentiality || 'Internal'} onValueChange={v => update('confidentiality', v)}>
                    <SelectTrigger className="h-8 text-xs bg-muted/40 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {CONFIDENTIALITIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}

            {/* ── Content tab (OCR text) ── */}
            {activeTab === 'content' && (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Extracted Text (OCR)</p>
                {editedDoc.text ? (
                  <div className="bg-muted/30 border border-border rounded p-3 text-xs text-foreground leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto font-mono">
                    {editedDoc.text}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileSearch size={24} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No extracted text available. Upload and run AI analysis to extract content.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Metadata tab ── */}
            {activeTab === 'metadata' && (
              <div className="space-y-3">
                <MetaRow label="Department" value={editedDoc.dept} />
                <MetaRow label="Version" value={editedDoc.version} />
                <MetaRow label="File Size" value={editedDoc.size} />
                <MetaRow label="Uploaded by" value={editedDoc.uploadedBy} />
                <MetaRow label="Storage type" value={editedDoc.storageType || 'local'} />
                <MetaRow label="Original filename" value={editedDoc.originalName} />
                {(editedDoc.products || []).length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Products / Services</p>
                    <div className="flex flex-wrap gap-1">
                      {(editedDoc.products || []).map(p => (
                        <span key={p} className="text-[10px] px-2 py-0.5 bg-muted rounded border border-border text-foreground">{p}</span>
                      ))}
                    </div>
                  </div>
                )}
                {editedDoc.summary && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">AI Summary</p>
                    <p className="text-xs text-foreground leading-relaxed">{editedDoc.summary}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Notes tab ── */}
            {activeTab === 'notes' && (
              <div className="space-y-3">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Notes</p>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add a note about this document..."
                  rows={6}
                  className="w-full rounded border border-border bg-muted/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary/90 transition-colors">
                  <Save size={11} /> Save Note
                </button>
              </div>
            )}

            {/* ── History tab ── */}
            {activeTab === 'history' && (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Document History</p>
                <div className="space-y-2">
                  {[
                    { action: 'Document uploaded', by: editedDoc.uploadedBy, date: editedDoc.createdAt?.slice(0, 10) },
                  ].map((h, i) => (
                    <div key={i} className="flex items-start gap-2 py-2 border-b border-border/50">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock size={10} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">{h.action}</p>
                        <p className="text-[10px] text-muted-foreground">{h.by} · {h.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Permissions tab ── */}
            {activeTab === 'permissions' && (
              <PermissionsTab doc={editedDoc} onUpdate={update} />
            )}
          </div>
        </div>

        {/* ── Right: Document viewer ── */}
        <div className="flex-1 bg-muted/20 overflow-auto flex items-start justify-center p-4">
          {isPdf && (
            <div className="relative">
              {pdfLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10 rounded">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {pdfError ? (
                <div className="w-[600px] h-[800px] flex items-center justify-center bg-card border border-border rounded-lg">
                  <div className="text-center p-6">
                    <FileText size={32} className="text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">Cannot render PDF</p>
                    <p className="text-xs text-muted-foreground">{pdfError}</p>
                    <p className="text-xs text-muted-foreground mt-2">The file may be too large or stored externally.</p>
                    <button onClick={handleDownload} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary/90 mx-auto">
                      <Download size={12} /> Download instead
                    </button>
                  </div>
                </div>
              ) : (
                <canvas ref={canvasRef} className="shadow-2xl rounded border border-border/50 bg-white" />
              )}
            </div>
          )}

          {isImage && editedDoc.fileUrl && editedDoc.fileUrl !== '[local]' && (
            <img src={editedDoc.fileUrl} alt={editedDoc.name} className="max-w-full shadow-2xl rounded border border-border/50" />
          )}

          {isDocx && editedDoc.htmlContent && (
            <div
              className="bg-white text-gray-900 p-8 max-w-3xl shadow-2xl rounded border border-border/50 prose prose-sm"
              dangerouslySetInnerHTML={{ __html: editedDoc.htmlContent }}
            />
          )}

          {!isPdf && !isImage && !isDocx && (
            <div className="flex flex-col items-center justify-center h-[400px] w-full">
              <FileText size={48} className="text-muted-foreground mb-4" />
              <p className="text-sm font-medium text-foreground mb-1">{editedDoc.originalName || editedDoc.name}</p>
              <p className="text-xs text-muted-foreground mb-4">Preview not available for this file type</p>
              {editedDoc.fileUrl && editedDoc.fileUrl !== '[local]' && (
                <button onClick={handleDownload} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 transition-colors">
                  <Download size={14} /> Download File
                </button>
              )}
              {editedDoc.text && (
                <div className="mt-4 bg-muted/50 border border-border rounded p-4 max-w-lg text-xs text-foreground font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {editedDoc.text.slice(0, 1000)}
                  {editedDoc.text.length > 1000 && '...'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helper sub-components ──
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</Label>
      {children}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border/50">
      <p className="text-[10px] text-muted-foreground w-28 shrink-0 mt-0.5">{label}</p>
      <p className="text-xs text-foreground break-all">{value}</p>
    </div>
  );
}

function PermissionsTab({ doc, onUpdate }: { doc: DocData; onUpdate: (f: any, v: any) => void }) {
  const perms = doc.permissions || {};
  const owner = doc.uploadedBy || 'Unknown';

  return (
    <div className="space-y-5">
      {/* Owner */}
      <div className="space-y-1.5">
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Owner</Label>
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border border-border rounded text-xs text-foreground">
          <User size={12} className="text-muted-foreground" />
          {owner}
        </div>
        <p className="text-[10px] text-muted-foreground">Objects without an owner can be viewed and edited by all users</p>
      </div>

      {/* View permissions */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Shield size={12} className="text-primary" /> View
        </p>
        <PermissionRow
          label="Users"
          value={Object.entries(perms).filter(([, v]) => v === 'view').map(([k]) => k).join(', ')}
          onChange={v => {
            const updated = { ...perms };
            // Simple: add viewer
            if (v) updated[v] = 'view';
            onUpdate('permissions', updated);
          }}
        />
        <PermissionRow label="Groups" value="" onChange={() => {}} />
      </div>

      {/* Edit permissions */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Pencil size={12} className="text-amber-400" /> Edit
        </p>
        <PermissionRow
          label="Users"
          value={Object.entries(perms).filter(([, v]) => v === 'edit').map(([k]) => k).join(', ')}
          onChange={v => {
            const updated = { ...perms };
            if (v) updated[v] = 'edit';
            onUpdate('permissions', updated);
          }}
        />
        <PermissionRow label="Groups" value="" onChange={() => {}} />
      </div>

      <p className="text-[10px] text-muted-foreground italic">Edit permissions also grant viewing permissions</p>

      {/* Current permissions list */}
      {Object.keys(perms).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Current Access</p>
          {Object.entries(perms).map(([user, role]) => (
            <div key={user} className="flex items-center justify-between py-1.5 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center">
                  {user.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-foreground">{user}</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                role === 'owner' ? 'bg-primary/15 text-primary border-primary/30' :
                role === 'edit' ? 'bg-amber-400/15 text-amber-400 border-amber-400/30' :
                'bg-muted text-muted-foreground border-border'
              }`}>{role}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PermissionRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-12">{label}</span>
      {editing ? (
        <div className="flex gap-1 flex-1">
          <Input value={val} onChange={e => setVal(e.target.value)} placeholder="Email or username"
            className="h-7 text-xs bg-muted/40 border-border flex-1" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') { onChange(val); setEditing(false); } }} />
          <button onClick={() => { onChange(val); setEditing(false); }} className="text-primary text-xs px-2">OK</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          className="flex-1 h-7 flex items-center gap-1.5 px-2 bg-muted/40 border border-border rounded text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-left">
          {value || <span className="text-muted-foreground/50">Select user...</span>}
          <Plus size={11} className="ml-auto" />
        </button>
      )}
    </div>
  );
}
