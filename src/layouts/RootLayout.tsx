import React, { useState, createContext, useContext, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, FileText, UploadCloud, LogOut, Tag, Users,
  Folder, Bookmark, Trash2, Settings, ChevronLeft, ChevronRight,
  Bell, Search, X, Workflow, Mail, HardDrive, Sliders, UserCog,
  ListTodo, ScrollText, ExternalLink,
} from 'lucide-react';
import { GlobalSearchProvider, useGlobalSearch } from '@/components/GlobalSearch';

// ── Open Documents Context ──────────────────────────────────────────────────
interface OpenDoc { id: string; name: string; }

interface OpenDocsCtx {
  openDocs: OpenDoc[];
  openDocument: (doc: OpenDoc) => void;
  closeDocument: (id: string) => void;
  closeAll: () => void;
}

const OpenDocsContext = createContext<OpenDocsCtx>({
  openDocs: [], openDocument: () => {}, closeDocument: () => {}, closeAll: () => {},
});

export function useOpenDocs() { return useContext(OpenDocsContext); }

export function OpenDocsProvider({ children }: { children: React.ReactNode }) {
  const [openDocs, setOpenDocs] = useState<OpenDoc[]>([]);

  const openDocument = useCallback((doc: OpenDoc) => {
    setOpenDocs(prev => {
      if (prev.find(d => d.id === doc.id)) return prev;
      return [doc, ...prev].slice(0, 10);
    });
  }, []);

  const closeDocument = useCallback((id: string) => {
    setOpenDocs(prev => prev.filter(d => d.id !== id));
  }, []);

  const closeAll = useCallback(() => setOpenDocs([]), []);

  return (
    <OpenDocsContext.Provider value={{ openDocs, openDocument, closeDocument, closeAll }}>
      {children}
    </OpenDocsContext.Provider>
  );
}

// ── Nav sections ──────────────────────────────────────────────────────────────
const TOP_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/documents', icon: FileText, label: 'Documents' },
];

const MANAGE_ITEMS = [
  { to: '/correspondents', icon: Users, label: 'Correspondents' },
  { to: '/tags', icon: Tag, label: 'Tags' },
  { to: '/document-types', icon: Folder, label: 'Document Types' },
  { to: '/storage-paths', icon: HardDrive, label: 'Storage Paths' },
  { to: '/custom-fields', icon: Sliders, label: 'Custom Fields' },
  { to: '/saved-views', icon: Bookmark, label: 'Saved Views' },
  { to: '/workflows', icon: Workflow, label: 'Workflows' },
  { to: '/mail', icon: Mail, label: 'Mail' },
  { to: '/trash', icon: Trash2, label: 'Trash' },
];

const ADMIN_ITEMS = [
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/configuration', icon: Sliders, label: 'Configuration' },
  { to: '/users-groups', icon: UserCog, label: 'Users & Groups' },
  { to: '/file-tasks', icon: ListTodo, label: 'File Tasks' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
];

const VERSION = 'DG Repo v1.0.0';

function RootLayoutInner() {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { openDocs, closeDocument, closeAll } = useOpenDocs();
  const { openSearch } = useGlobalSearch();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!currentUser) return null;

  const displayName = userProfile?.name || currentUser.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();
  const empId = userProfile?.employeeId || '';
  const dept = userProfile?.department || '';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-2 py-1.5 rounded text-sm transition-colors ${
      isActive
        ? 'bg-primary text-white font-medium'
        : 'text-[var(--sidebar-muted)] hover:text-white hover:bg-white/8'
    } ${collapsed ? 'justify-center px-2' : ''}`;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* ─── Sidebar ─── */}
      <aside className={`plex-sidebar flex flex-col transition-all duration-200 shrink-0 ${collapsed ? 'w-14' : 'w-60'}`}>

        {/* Brand */}
        <div className={`flex items-center gap-2.5 px-3 py-3.5 border-b border-[var(--sidebar-border)] ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white text-xs shrink-0">
            DG
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white leading-tight truncate">DG Repo</p>
              <p className="text-[10px] text-[var(--sidebar-muted)]">Document Management</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-[var(--sidebar-muted)] hover:text-white p-0.5 rounded transition-colors shrink-0"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Search (in sidebar like Paperless) */}
        {!collapsed && (
          <div className="px-3 py-2 border-b border-[var(--sidebar-border)]">
            <button onClick={openSearch}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-white/8 border border-white/10 text-[var(--sidebar-muted)] text-xs cursor-pointer hover:bg-white/12 transition-colors">
              <Search size={12} />
              <span className="flex-1 text-left">Search</span>
              <kbd className="text-[9px] opacity-60">⌘K</kbd>
            </button>
          </div>
        )}

        {/* Nav scroll area */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">

          {/* Top items: Dashboard, Documents */}
          {TOP_ITEMS.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass} title={collapsed ? item.label : undefined}>
              <item.icon size={16} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}

          {/* OPEN DOCUMENTS */}
          {!collapsed && openDocs.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between px-2 mb-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--sidebar-muted)]">Open Documents</p>
                <button onClick={closeAll} className="text-[9px] text-[var(--sidebar-muted)] hover:text-white flex items-center gap-0.5 transition-colors">
                  <X size={9} /> Close all
                </button>
              </div>
              {openDocs.map(d => (
                <div key={d.id} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/8 cursor-pointer group transition-colors"
                  onClick={() => navigate(`/documents/${d.id}`)}>
                  <FileText size={12} className="text-[var(--sidebar-muted)] shrink-0" />
                  <span className="text-xs text-[var(--sidebar-muted)] group-hover:text-white truncate flex-1 transition-colors">
                    {d.name.slice(0, 20)}...
                  </span>
                  <button onClick={e => { e.stopPropagation(); closeDocument(d.id); }}
                    className="opacity-0 group-hover:opacity-100 text-[var(--sidebar-muted)] hover:text-white transition-all">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* MANAGE section */}
          <div className="mt-4">
            {!collapsed && (
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--sidebar-muted)] px-2 pb-1.5">Manage</p>
            )}
            {MANAGE_ITEMS.map(item => (
              <NavLink key={item.to} to={item.to} className={navLinkClass} title={collapsed ? item.label : undefined}>
                <item.icon size={16} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>

          {/* ADMINISTRATION section */}
          <div className="mt-4">
            {!collapsed && (
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--sidebar-muted)] px-2 pb-1.5">Administration</p>
            )}
            {ADMIN_ITEMS.map(item => (
              <NavLink key={item.to} to={item.to} className={navLinkClass} title={collapsed ? item.label : undefined}>
                <item.icon size={16} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Bottom: version + user */}
        <div className="border-t border-[var(--sidebar-border)]">
          {!collapsed && (
            <div className="px-3 py-1.5">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[9px] text-[var(--sidebar-muted)] hover:text-white transition-colors">
                <ExternalLink size={9} /> Documentation
              </a>
              <p className="text-[9px] text-[var(--sidebar-muted)]/60 mt-0.5">{VERSION}</p>
            </div>
          )}
          <div className="p-3">
            {collapsed ? (
              <button onClick={handleLogout}
                className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold hover:bg-destructive/20 hover:text-destructive transition-colors"
                title="Sign Out">
                {initials}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{displayName}</p>
                    <p className="text-[10px] text-[var(--sidebar-muted)] truncate">
                      {empId ? `${empId} · ` : ''}{dept || currentUser.email}
                    </p>
                  </div>
                  <button onClick={handleLogout} title="Sign out"
                    className="text-[var(--sidebar-muted)] hover:text-destructive transition-colors p-1">
                    <LogOut size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-12 border-b border-border bg-background flex items-center gap-3 px-4 shrink-0">
          <button onClick={openSearch}
            className="flex-1 flex items-center gap-2 bg-muted/40 border border-border rounded-md px-3 py-1.5 cursor-pointer hover:bg-muted/60 transition-colors max-w-lg text-left">
            <Search size={13} className="text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground flex-1">Search documents, OCR text, invoice numbers…</span>
            <kbd className="hidden sm:block text-[10px] text-muted-foreground/60 bg-muted border border-border rounded px-1.5 py-0.5 shrink-0">Ctrl K</kbd>
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <button className="text-muted-foreground hover:text-foreground p-1.5 rounded transition-colors relative">
              <Bell size={16} />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white cursor-pointer"
              onClick={() => navigate('/settings')}>
              {initials}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-background">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function RootLayout() {
  return (
    <GlobalSearchProvider>
      <RootLayoutInner />
    </GlobalSearchProvider>
  );
}
