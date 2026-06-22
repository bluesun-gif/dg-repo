import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, orderBy, query, limit } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, HardDrive, Upload, Clock, ArrowRight, Plus, TrendingUp } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface Stats {
  docCount: number;
  userCount: number;
  storageMb: number;
  tagCount: number;
}

interface RecentDoc {
  id: string;
  name: string;
  originalName?: string;
  category?: string;
  client?: string;
  date?: string;
  createdAt?: string;
  confidentiality?: string;
  tags?: string[];
}

const CONFIDENTIALITY_COLORS: Record<string, string> = {
  Public: 'text-emerald-400 bg-emerald-400/10',
  Internal: 'text-blue-400 bg-blue-400/10',
  Confidential: 'text-amber-400 bg-amber-400/10',
  Restricted: 'text-red-400 bg-red-400/10',
};

function parseSizeMb(sizeStr: string): number {
  if (!sizeStr) return 0;
  const val = parseFloat(sizeStr);
  if (isNaN(val)) return 0;
  if (sizeStr.includes('GB')) return val * 1024;
  if (sizeStr.includes('MB')) return val;
  if (sizeStr.includes('KB')) return val / 1024;
  return val / (1024 * 1024);
}

function formatStorage(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return `${(mb * 1024).toFixed(0)} KB`;
}

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ docCount: 0, userCount: 0, storageMb: 0, tagCount: 0 });
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);

      // ── 1. Merge Firestore + localStorage, deduplicated by id ────────────────
      const seen = new Set<string>();
      const allDocs: any[] = [];

      // Always try localStorage first (works offline)
      try {
        const localDocs: any[] = JSON.parse(localStorage.getItem('local_documents') || '[]');
        for (const d of localDocs) {
          if (d.isDeleted) continue;
          if (!seen.has(d.id)) { seen.add(d.id); allDocs.push(d); }
        }
      } catch { /* empty */ }

      // Then Firestore (overrides localStorage for same id)
      try {
        const snap = await getDocs(collection(db, 'documents'));
        snap.forEach(d => {
          const data = { id: d.id, ...d.data() } as any;
          if (data.isDeleted) return;
          if (!seen.has(data.id)) { seen.add(data.id); allDocs.push(data); }
          else {
            // Replace the localStorage version with the Firestore version
            const idx = allDocs.findIndex((x: any) => x.id === data.id);
            if (idx >= 0) allDocs[idx] = data;
          }
        });
      } catch { /* offline or rules */ }

      // ── 2. Compute stats from merged list ────────────────────────────────────
      let totalBytes = 0;
      const allTags = new Set<string>();
      const catMap: Record<string, number> = {};
      const recent: RecentDoc[] = [];

      for (const d of allDocs) {
        // Storage: prefer exact bytes, fall back to parsed formatted string
        if (typeof d.sizeBytesRaw === 'number' && d.sizeBytesRaw > 0) {
          totalBytes += d.sizeBytesRaw;
        } else if (d.size) {
          totalBytes += parseSizeMb(d.size) * 1024 * 1024;
        }

        // Tags — handle both string[] and {name, color}[] formats
        if (Array.isArray(d.tags)) {
          d.tags.forEach((t: unknown) => {
            if (!t) return;
            const name = typeof t === 'string' ? t.trim() : typeof t === 'object' && t !== null && 'name' in t ? String((t as any).name).trim() : '';
            if (name) allTags.add(name.toLowerCase());
          });
        }

        // Category
        if (d.category) catMap[d.category] = (catMap[d.category] || 0) + 1;

        recent.push(d);
      }

      // Storage in MB for formatStorage()
      const storageMb = totalBytes / (1024 * 1024);

      // ── 3. Users ─────────────────────────────────────────────────────────────
      let userCount = 0;
      try {
        const snap = await getDocs(collection(db, 'users'));
        userCount = snap.size;
      } catch { userCount = 1; /* at least the current user */ }

      // ── 4. Sort recent by createdAt desc ─────────────────────────────────────
      recent.sort((a, b) => {
        const da = a.createdAt || a.date || '';
        const db2 = b.createdAt || b.date || '';
        return db2.localeCompare(da);
      });

      setStats({ docCount: allDocs.length, userCount, storageMb, tagCount: allTags.size });
      setRecentDocs(recent.slice(0, 8));
      setCategoryMap(catMap);
      setLoading(false);
    }

    fetchStats();

    // Refresh stats whenever the tab becomes visible again (e.g. after upload)
    const handleVisibility = () => { if (document.visibilityState === 'visible') fetchStats(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refreshKey]);

  const onDrop = useCallback((files: File[]) => {
    if (files.length > 0) navigate('/upload');
  }, [navigate]);

  // @ts-expect-error react 19 dropzone type
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  const displayName = userProfile?.name || currentUser?.email?.split('@')[0] || 'there';
  const maxCat = Math.max(...(Object.values(categoryMap) as number[]), 1);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Hello {displayName}, welcome to <span className="text-primary">DG Repo</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your corporate document management system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            title="Refresh stats"
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
              <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={15} />
            Upload Document
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Documents"
          value={loading ? '—' : stats.docCount.toLocaleString()}
          icon={<FileText size={18} className="text-primary" />}
          color="primary"
        />
        <StatCard
          label="Registered Users"
          value={loading ? '—' : stats.userCount.toLocaleString()}
          icon={<Users size={18} className="text-blue-400" />}
          color="blue"
        />
        <StatCard
          label="Storage Used"
          value={loading ? '—' : formatStorage(stats.storageMb)}
          icon={<HardDrive size={18} className="text-amber-400" />}
          color="amber"
        />
        <StatCard
          label="Unique Tags"
          value={loading ? '—' : stats.tagCount.toLocaleString()}
          icon={<TrendingUp size={18} className="text-violet-400" />}
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Recent uploads */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock size={15} className="text-primary" />
              Recent Uploads
            </div>
            <button
              onClick={() => navigate('/documents')}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
          ) : recentDocs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No documents yet. <button onClick={() => navigate('/upload')} className="text-primary hover:underline">Upload the first one →</button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentDocs.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => navigate('/documents')}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText size={14} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {doc.originalName || doc.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {doc.client && `${doc.client} · `}{doc.date || doc.createdAt?.slice(0, 10)}
                    </p>
                  </div>
                  {doc.confidentiality && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CONFIDENTIALITY_COLORS[doc.confidentiality] || ''}`}>
                      {doc.confidentiality}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick Upload Drop Zone */}
          <div
            {...getRootProps()}
            className={`bg-card border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
            onClick={() => navigate('/upload')}
          >
            <input {...getInputProps()} />
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Upload size={18} className="text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {isDragActive ? 'Drop file here!' : 'Upload documents'}
            </p>
            <p className="text-xs text-muted-foreground">
              Drag & drop or click to browse
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              PDF, DOCX, TXT, PNG, JPG supported
            </p>
          </div>

          {/* Category breakdown */}
          {Object.keys(categoryMap).length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                By Category
              </p>
              <div className="space-y-2.5">
                {Object.entries(categoryMap)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .slice(0, 6)
                  .map(([cat, count]) => (
                    <div key={cat}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-foreground truncate">{cat}</span>
                        <span className="text-muted-foreground ml-2 shrink-0">{count as number}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(((count as number) / maxCat) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const borderColors: Record<string, string> = {
    primary: 'border-l-primary',
    blue: 'border-l-blue-400',
    amber: 'border-l-amber-400',
    violet: 'border-l-violet-400',
  };
  return (
    <div className={`bg-card border border-border border-l-2 ${borderColors[color]} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <div className="p-1.5 bg-muted rounded">{icon}</div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
