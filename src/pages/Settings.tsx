import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Check, HelpCircle, Activity } from 'lucide-react';

type SettingsTab = 'general' | 'permissions' | 'notifications';

interface AppSettings {
  displayLanguage: string;
  dateDisplay: string;
  dateFormat: 'short' | 'medium' | 'long';
  itemsPerPage: number;
  slimSidebar: boolean;
  darkMode: boolean;
  enableDarkMode: boolean;
  invertThumbnailsDark: boolean;
  themeColor: string;
  enableUpdateChecking: boolean;
  showSavedViewsWarning: boolean;
  showDocCountSidebar: boolean;
  useBrowserPdfViewer: boolean;
  defaultZoom: string;
  autoRemoveInboxTags: boolean;
  showThumbnailDuringLoading: boolean;
  globalSearchAdvanced: boolean;
  fullSearchLinksTo: string;
  showConfirmDialogs: boolean;
  applyOnClose: boolean;
  enableNotes: boolean;
}

const DEFAULTS: AppSettings = {
  displayLanguage: 'system',
  dateDisplay: 'system',
  dateFormat: 'medium',
  itemsPerPage: 50,
  slimSidebar: false,
  darkMode: true,
  enableDarkMode: true,
  invertThumbnailsDark: true,
  themeColor: '#10b981',
  enableUpdateChecking: false,
  showSavedViewsWarning: true,
  showDocCountSidebar: true,
  useBrowserPdfViewer: false,
  defaultZoom: 'fit-width',
  autoRemoveInboxTags: false,
  showThumbnailDuringLoading: true,
  globalSearchAdvanced: false,
  fullSearchLinksTo: 'title-content',
  showConfirmDialogs: true,
  applyOnClose: false,
  enableNotes: true,
};

function loadSettings(): AppSettings {
  try {
    const s = localStorage.getItem('dg_settings');
    return s ? { ...DEFAULTS, ...JSON.parse(s) } : DEFAULTS;
  } catch { return DEFAULTS; }
}

function CB({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'}`}
        onClick={() => onChange(!checked)}>
        {checked && <Check size={10} className="text-white" />}
      </div>
      <div>
        <p className="text-sm text-foreground">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
    </label>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="h-9 min-w-48 px-3 bg-muted/40 border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-6 py-4 border-b border-border/50">
      <div className="w-44 shrink-0 pt-1">
        <p className="text-sm text-foreground">{label}</p>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-bold text-foreground mb-1">{title}</h2>
      <div className="bg-card border border-border rounded-xl overflow-hidden px-6">
        {children}
      </div>
    </div>
  );
}

export default function Settings() {
  const { currentUser, userProfile } = useAuth();
  const [tab, setTab] = useState<SettingsTab>('general');
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setSaving(true);
    try {
      localStorage.setItem('dg_settings', JSON.stringify(settings));
      toast.success('Settings saved');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const handleCancel = () => {
    setSettings(loadSettings());
    toast.info('Changes discarded');
  };

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'permissions', label: 'Permissions' },
    { id: 'notifications', label: 'Notifications' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded text-muted-foreground hover:bg-muted/50 transition-colors">
            <Activity size={12} /> System Status
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* General tab */}
      {tab === 'general' && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <Section title="Appearance">
              <Row label="Display language">
                <Select value={settings.displayLanguage} onChange={v => set('displayLanguage', v)} options={[
                  { value: 'system', label: 'Use system language' },
                  { value: 'en', label: 'English' },
                  { value: 'bn', label: 'Bengali' },
                ]} />
              </Row>
              <Row label="Date display">
                <Select value={settings.dateDisplay} onChange={v => set('dateDisplay', v)} options={[
                  { value: 'system', label: 'Use date format of display language' },
                  { value: 'iso', label: 'ISO 8601 (2026-06-22)' },
                ]} />
              </Row>
              <Row label="Date format">
                <div className="space-y-1.5">
                  {(['short', 'medium', 'long'] as const).map(f => (
                    <label key={f} className="flex items-center gap-2 cursor-pointer">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        settings.dateFormat === f ? 'border-primary' : 'border-border'
                      }`} onClick={() => set('dateFormat', f)}>
                        {settings.dateFormat === f && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </div>
                      <span className="text-sm text-foreground">
                        {f === 'short' ? 'Short: 6/22/26' : f === 'medium' ? 'Medium: Jun 22, 2026' : 'Long: June 22, 2026'}
                      </span>
                    </label>
                  ))}
                </div>
              </Row>
              <Row label="Items per page">
                <Select value={String(settings.itemsPerPage)} onChange={v => set('itemsPerPage', +v)} options={[
                  { value: '10', label: '10' }, { value: '25', label: '25' },
                  { value: '50', label: '50' }, { value: '100', label: '100' },
                ]} />
              </Row>
              <Row label="Sidebar">
                <CB checked={settings.slimSidebar} onChange={v => set('slimSidebar', v)} label="Use 'slim' sidebar (icons only)" />
              </Row>
              <Row label="Dark mode">
                <div className="space-y-2">
                  <CB checked={settings.darkMode} onChange={v => set('darkMode', v)} label="Use system settings" />
                  <CB checked={settings.enableDarkMode} onChange={v => set('enableDarkMode', v)} label="Enable dark mode" />
                  <CB checked={settings.invertThumbnailsDark} onChange={v => set('invertThumbnailsDark', v)} label="Invert thumbnails in dark mode" />
                </div>
              </Row>
              <Row label="Theme Color">
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.themeColor} onChange={e => set('themeColor', e.target.value)}
                    className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent" />
                  <button onClick={() => set('themeColor', '#10b981')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    × Reset
                  </button>
                </div>
              </Row>
            </Section>

            <Section title="Update checking">
              <Row label="">
                <CB checked={settings.enableUpdateChecking} onChange={v => set('enableUpdateChecking', v)} label="Enable update checking" />
              </Row>
            </Section>

            <Section title="Saved Views">
              <Row label="">
                <div className="space-y-2">
                  <CB checked={settings.showSavedViewsWarning} onChange={v => set('showSavedViewsWarning', v)}
                    label="Show warning when closing saved views with unsaved changes" />
                  <CB checked={settings.showDocCountSidebar} onChange={v => set('showDocCountSidebar', v)}
                    label="Show document counts in sidebar saved views" />
                </div>
              </Row>
            </Section>
          </div>

          <div>
            <Section title="Document editing">
              <Row label="">
                <div className="space-y-2">
                  <CB checked={settings.useBrowserPdfViewer} onChange={v => set('useBrowserPdfViewer', v)}
                    label="Use PDF viewer provided by the browser"
                    desc="This is usually faster for displaying large PDF documents, but it might not work on some browsers." />
                </div>
              </Row>
              <Row label="Default zoom">
                <Select value={settings.defaultZoom} onChange={v => set('defaultZoom', v)} options={[
                  { value: 'fit-width', label: 'Fit width' },
                  { value: 'fit-page', label: 'Fit page' },
                  { value: '100', label: '100%' },
                  { value: '150', label: '150%' },
                ]} />
              </Row>
              <Row label="">
                <div className="space-y-2">
                  <CB checked={settings.autoRemoveInboxTags} onChange={v => set('autoRemoveInboxTags', v)}
                    label="Automatically remove inbox tag(s) on save" />
                  <CB checked={settings.showThumbnailDuringLoading} onChange={v => set('showThumbnailDuringLoading', v)}
                    label="Show document thumbnail during loading" />
                </div>
              </Row>
            </Section>

            <Section title="Global search">
              <Row label="">
                <CB checked={settings.globalSearchAdvanced} onChange={v => set('globalSearchAdvanced', v)}
                  label="Do not include advanced search results" />
              </Row>
              <Row label="Full search links to">
                <Select value={settings.fullSearchLinksTo} onChange={v => set('fullSearchLinksTo', v)} options={[
                  { value: 'title-content', label: 'Title and content search' },
                  { value: 'advanced', label: 'Advanced search' },
                ]} />
              </Row>
            </Section>

            <Section title="Bulk editing">
              <Row label="">
                <div className="space-y-2">
                  <CB checked={settings.showConfirmDialogs} onChange={v => set('showConfirmDialogs', v)}
                    label="Show confirmation dialogs" />
                  <CB checked={settings.applyOnClose} onChange={v => set('applyOnClose', v)}
                    label="Apply on close" />
                </div>
              </Row>
            </Section>

            <Section title="Notes">
              <Row label="">
                <CB checked={settings.enableNotes} onChange={v => set('enableNotes', v)} label="Enable notes" />
              </Row>
            </Section>
          </div>
        </div>
      )}

      {/* Permissions tab */}
      {tab === 'permissions' && (
        <div className="max-w-2xl">
          <Section title="Default Permissions">
            <p className="text-sm text-muted-foreground py-3">
              Settings apply to this user account for objects (Tags, Mail Rules, etc. but not documents) created via the web UI.
            </p>
            <Row label="Default Owner">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 border border-border rounded text-sm text-foreground min-w-48">
                  {userProfile?.name || currentUser?.email?.split('@')[0] || 'demo'}
                  <button className="ml-auto text-muted-foreground hover:text-foreground">
                    <span className="text-xs">×</span>
                  </button>
                </div>
                <button className="w-8 h-8 border border-border rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                  <span className="text-xs">▾</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Objects without an owner can be viewed and edited by all users</p>
            </Row>
            <Row label="Default View Permissions">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-14">Users:</span>
                  <select className="flex-1 h-8 px-2 bg-muted/40 border border-border rounded text-sm text-foreground focus:outline-none">
                    <option value="">—</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-14">Groups:</span>
                  <select className="flex-1 h-8 px-2 bg-muted/40 border border-border rounded text-sm text-foreground focus:outline-none">
                    <option value="">—</option>
                  </select>
                </div>
              </div>
            </Row>
            <Row label="Default Edit Permissions">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-14">Users:</span>
                  <select className="flex-1 h-8 px-2 bg-muted/40 border border-border rounded text-sm text-foreground focus:outline-none">
                    <option value="">—</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-14">Groups:</span>
                  <select className="flex-1 h-8 px-2 bg-muted/40 border border-border rounded text-sm text-foreground focus:outline-none">
                    <option value="">—</option>
                  </select>
                </div>
              </div>
            </Row>
            <div className="py-3 text-right text-xs text-primary">Edit permissions also grant viewing permissions</div>
          </Section>
        </div>
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <div className="max-w-2xl">
          <Section title="Notifications">
            <Row label="">
              <div className="space-y-3 py-2">
                <CB checked={true} onChange={() => {}} label="Notify on successful document consumption" />
                <CB checked={false} onChange={() => {}} label="Notify on failed document consumption" />
                <CB checked={true} onChange={() => {}} label="Notify on document shared with me" />
              </div>
            </Row>
          </Section>
        </div>
      )}

      {/* Save / Cancel */}
      <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border">
        <button onClick={handleCancel} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded hover:bg-muted/50 transition-colors">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : <><Check size={13} /> Save</>}
        </button>
      </div>
    </div>
  );
}
