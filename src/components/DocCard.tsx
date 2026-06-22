import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePdfThumbnail } from '@/hooks/usePdfThumbnail';
import {
  FileText, FileImage, FileSpreadsheet, File,
  Pencil, Eye, Download, Clock, Tag,
} from 'lucide-react';

interface DocItem {
  id: string;
  name: string;
  originalName?: string;
  date?: string;
  createdAt?: string;
  size?: string;
  tags?: string[];
  client?: string;
  category?: string;
  dept?: string;
  confidentiality?: string;
  fileUrl?: string;
  text?: string;
  isDeleted?: boolean;
}

export interface DocCardProps {
  doc: DocItem;
  onDelete?: (id: string) => void;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  key?: React.Key;
}

const getExt = (name: string) => name.split('.').pop()?.toLowerCase() || '';

function FileIconFallback({ name }: { name: string }) {
  const ext = getExt(name);
  const isImg = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);
  const isSheet = ['csv', 'xlsx', 'xls'].includes(ext);
  const isPdf = ext === 'pdf';

  const bg = isPdf ? 'bg-red-500/15 border-red-500/30' :
    isImg ? 'bg-blue-500/15 border-blue-500/30' :
      isSheet ? 'bg-green-500/15 border-green-500/30' :
        'bg-muted border-border';

  const Icon = isImg ? FileImage : isSheet ? FileSpreadsheet : isPdf ? FileText : File;
  const color = isPdf ? 'text-red-400' : isImg ? 'text-blue-400' : isSheet ? 'text-green-400' : 'text-muted-foreground';

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center ${bg} border rounded`}>
      <Icon size={28} className={color} />
      <span className="text-[9px] mt-1 text-muted-foreground uppercase font-mono">{ext}</span>
    </div>
  );
}

function HoverPreview({ doc, visible }: { doc: DocItem; visible: boolean }) {
  const ext = getExt(doc.originalName || doc.name);
  const isPdf = ext === 'pdf';
  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
  const { dataUrl } = usePdfThumbnail(
    visible && isPdf ? doc.fileUrl : undefined,
    0.8 // larger scale for preview popup
  );

  if (!visible) return null;

  return (
    <div className="absolute left-full top-0 ml-2 z-50 w-72 bg-card border border-border rounded-lg shadow-2xl overflow-hidden pointer-events-none">
      {/* Preview area */}
      <div className="w-full h-64 bg-muted/40 flex items-center justify-center overflow-hidden">
        {isPdf && dataUrl ? (
          <img src={dataUrl} alt="preview" className="w-full object-contain object-top" />
        ) : isImage && doc.fileUrl && doc.fileUrl !== '[local]' ? (
          <img src={doc.fileUrl} alt="preview" className="w-full h-full object-contain" />
        ) : doc.text ? (
          <div className="p-3 text-[10px] text-foreground font-mono leading-relaxed overflow-hidden h-full text-left w-full">
            {doc.text.slice(0, 400)}
          </div>
        ) : (
          <FileIconFallback name={doc.name} />
        )}
      </div>
      {/* Info */}
      <div className="p-3 border-t border-border">
        <p className="text-xs font-semibold text-foreground truncate">{doc.originalName || doc.name}</p>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
          <Clock size={9} />
          <span>{doc.date || doc.createdAt?.slice(0, 10) || '—'}</span>
          {doc.client && <><span>·</span><span>{doc.client}</span></>}
        </div>
        {(doc.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {(doc.tags || []).slice(0, 4).map(t => (
              <span key={t} className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DocCard({ doc, onDelete, selected = false, onSelect }: DocCardProps) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ext = getExt(doc.originalName || doc.name);
  const isPdf = ext === 'pdf';
  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);

  const { dataUrl, pageCount, loading } = usePdfThumbnail(
    isPdf ? doc.fileUrl : isImage ? doc.fileUrl : undefined,
    0.3
  );

  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(() => setHovered(true), 600);
  };
  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHovered(false);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!doc.fileUrl || doc.fileUrl === '[local]') return;
    const a = document.createElement('a');
    a.href = doc.fileUrl;
    a.download = doc.originalName || doc.name;
    a.click();
  };

  const confColor = doc.confidentiality === 'Public' ? 'bg-emerald-500/15 text-emerald-400' :
    doc.confidentiality === 'Confidential' ? 'bg-red-500/15 text-red-400' :
      doc.confidentiality === 'Restricted' ? 'bg-orange-500/15 text-orange-400' :
        'bg-muted text-muted-foreground';

  return (
    <div
      className="relative group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`bg-card border rounded-lg overflow-hidden transition-all duration-200 cursor-pointer
        ${selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50 hover:shadow-lg hover:shadow-black/20'}`}
        onClick={() => navigate(`/documents/${doc.id}`)}
      >
        {/* Thumbnail */}
        <div className="relative w-full aspect-[3/4] bg-muted/30 overflow-hidden">
          {/* Selection checkbox */}
          <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => { e.stopPropagation(); onSelect?.(doc.id, !selected); }}>
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors
              ${selected ? 'bg-primary border-primary' : 'bg-card/80 border-border backdrop-blur-sm'}`}>
              {selected && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>}
            </div>
          </div>

          {/* Confidentiality badge */}
          {doc.confidentiality && doc.confidentiality !== 'Internal' && (
            <div className={`absolute top-2 right-2 z-10 text-[8px] px-1.5 py-0.5 rounded font-semibold ${confColor}`}>
              {doc.confidentiality}
            </div>
          )}

          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : dataUrl ? (
            <img
              src={dataUrl}
              alt={doc.name}
              className="w-full h-full object-contain object-top bg-white"
              loading="lazy"
            />
          ) : (
            <FileIconFallback name={doc.originalName || doc.name} />
          )}
        </div>

        {/* Info */}
        <div className="p-2.5 border-t border-border/50">
          <p className="text-xs font-medium text-foreground truncate leading-tight">
            {doc.originalName || doc.name}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock size={9} />
              {doc.date || doc.createdAt?.slice(0, 10) || '—'}
            </span>
            {pageCount > 0 && (
              <span className="text-[10px] text-muted-foreground">{pageCount} pages</span>
            )}
          </div>
          {(doc.tags || []).length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-1.5">
              {(doc.tags || []).slice(0, 3).map(t => (
                <span key={t} className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full flex items-center gap-0.5">
                  <Tag size={7} />{t}
                </span>
              ))}
              {(doc.tags || []).length > 3 && (
                <span className="text-[9px] text-muted-foreground px-1">+{doc.tags!.length - 3}</span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-1 mt-2 pt-2 border-t border-border/50">
            <ActionBtn title="Edit" onClick={e => { e.stopPropagation(); navigate(`/documents/${doc.id}`); }}>
              <Pencil size={12} />
            </ActionBtn>
            <ActionBtn title="Preview" onClick={e => { e.stopPropagation(); navigate(`/documents/${doc.id}`); }}>
              <Eye size={12} />
            </ActionBtn>
            <ActionBtn title="Download" onClick={handleDownload}>
              <Download size={12} />
            </ActionBtn>
          </div>
        </div>
      </div>

      {/* Hover preview popup */}
      <HoverPreview doc={doc} visible={hovered} />
    </div>
  );
}

function ActionBtn({ children, onClick, title }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; title: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex-1 flex items-center justify-center py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
    >
      {children}
    </button>
  );
}
