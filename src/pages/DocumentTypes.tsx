import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { Folder, BarChart3 } from 'lucide-react';

interface DocType {
  name: string;
  docCount: number;
  departments: string[];
}

const TYPE_ICONS: Record<string, string> = {
  'Technical Proposal': '⚙️',
  'Financial Proposal': '💰',
  'Contract': '📝',
  'RFP': '📋',
  'Architecture': '🏗️',
  'Report': '📊',
  'Invoice': '🧾',
  'Other': '📁',
};

export default function DocumentTypes() {
  const [types, setTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const total = types.reduce((s, t) => s + t.docCount, 0);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const map: Record<string, { docCount: number; departments: Set<string> }> = {};

      const addEntry = (category: string, dept: string) => {
        if (!category) return;
        if (!map[category]) map[category] = { docCount: 0, departments: new Set() };
        map[category].docCount++;
        if (dept) map[category].departments.add(dept);
      };

      try {
        const snap = await getDocs(collection(db, 'documents'));
        snap.forEach(d => { const data = d.data(); if (!data.isDeleted) addEntry(data.category, data.dept); });
      } catch {}
      try {
        const local = JSON.parse(localStorage.getItem('local_documents') || '[]');
        local.forEach((d: any) => { if (!d.isDeleted) addEntry(d.category, d.dept); });
      } catch {}

      const result: DocType[] = Object.entries(map).map(([name, data]) => ({
        name,
        docCount: data.docCount,
        departments: Array.from(data.departments),
      }));
      setTypes(result.sort((a, b) => b.docCount - a.docCount));
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-violet-400/10 flex items-center justify-center">
          <Folder size={18} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Document Types</h1>
          <p className="text-sm text-muted-foreground">Categories of documents in your repository</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
      ) : types.length === 0 ? (
        <div className="text-center py-12">
          <Folder size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No document types yet. Upload documents with categories to populate this list.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {types.map(t => (
              <div key={t.name} className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors">
                <div className="text-2xl mb-2">{TYPE_ICONS[t.name] || '📄'}</div>
                <p className="text-sm font-semibold text-foreground mb-0.5">{t.name}</p>
                <p className="text-2xl font-bold text-primary">{t.docCount}</p>
                <p className="text-xs text-muted-foreground">document{t.docCount !== 1 ? 's' : ''}</p>
                {t.departments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.departments.map(d => (
                      <span key={d} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{d}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={15} className="text-primary" />
              <p className="text-sm font-semibold text-foreground">Distribution</p>
            </div>
            <div className="space-y-3">
              {types.map(t => (
                <div key={t.name} className="flex items-center gap-3">
                  <p className="text-xs text-muted-foreground w-36 shrink-0 truncate">{TYPE_ICONS[t.name] || '📄'} {t.name}</p>
                  <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: total > 0 ? `${(t.docCount / total) * 100}%` : '0%' }}
                    />
                  </div>
                  <p className="text-xs text-foreground font-medium w-8 text-right">{t.docCount}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
