import React, { useState, useEffect, useRef } from 'react';
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '@/firebase';
import {
  Mail, Plus, Pencil, Trash2, X, Check, AlertCircle,
  Loader2, ChevronDown, Info, TestTube2, ToggleLeft,
  ShieldCheck, Inbox,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MailAccount {
  id: string;
  name: string;
  imapServer: string;
  imapPort: string;
  imapSecurity: string;
  username: string;
  password: string;
  passwordIsToken: boolean;
  characterSet: string;
  createdAt?: string;
}

interface MailRule {
  id: string;
  name: string;
  accountId: string;
  order: string;
  enabled: boolean;
  folder: string;
  maxAgeDays: string;
  filterFrom: string;
  filterTo: string;
  filterSubject: string;
  filterBody: string;
  consumptionAction: string;
  folderContentType: string;
  includeFilesMatching: string;
  excludeFilesMatching: string;
  pdfLayout: string;
  action: string;
  assignTags: string;
  assignDocumentType: string;
  createdAt?: string;
}

const IMAP_SECURITY_OPTIONS = ['None', 'SSL', 'STARTTLS'];

const CONSUMPTION_ACTIONS = [
  'Only process attachments',
  'Process all mails',
  'Process only inline attachments',
];

const FOLDER_CONTENT_TYPES = [
  'Only process attachments',
  'Process the PDF version of the mail',
  'Process the full mail',
];

const RULE_ACTIONS = [
  "Mark as read, don't process read mails",
  'Flag the mail',
  'Move to a folder',
  'Delete the mail',
];

const PDF_LAYOUTS = ['System default', 'Paperless default layout', 'Paperless default layout (compact)'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SelectField({ value, onChange, options, placeholder, disabled }: {
  value: string; onChange: (v: string) => void; options: string[];
  placeholder?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)}
        className="w-full h-9 px-3 flex items-center justify-between bg-muted/40 border border-border rounded-lg text-sm text-foreground hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{value || placeholder || 'Select…'}</span>
        <ChevronDown size={13} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden py-1">
            {options.map(o => (
              <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${value === o ? 'bg-primary/15 text-primary font-medium' : 'text-foreground hover:bg-muted/60'}`}>
                {value === o && <Check size={11} />}
                <span className={value !== o ? 'ml-4' : ''}>{o}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-muted border border-border'}`}>
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

function FormRow({ label, children, half }: { label: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div className={half ? '' : ''}>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
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
            <p className="text-sm font-semibold text-foreground">Confirm deletion</p>
            <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone.</p>
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

// ─── Mail Account Modal ───────────────────────────────────────────────────────
function AccountModal({ initial, onSave, onClose }: {
  initial?: MailAccount; onSave: (data: Omit<MailAccount, 'id'>) => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [imapServer, setImapServer] = useState(initial?.imapServer || '');
  const [imapPort, setImapPort] = useState(initial?.imapPort || '993');
  const [imapSecurity, setImapSecurity] = useState(initial?.imapSecurity || 'SSL');
  const [username, setUsername] = useState(initial?.username || '');
  const [password, setPassword] = useState(initial?.password || '');
  const [passwordIsToken, setPasswordIsToken] = useState(initial?.passwordIsToken || false);
  const [characterSet, setCharacterSet] = useState(initial?.characterSet || 'UTF-8');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    if (!imapServer || !username) { toast.error('Enter server and username first'); return; }
    setTesting(true);
    await new Promise(r => setTimeout(r, 1200));
    toast.info('Connection test: requires real IMAP server to be configured');
    setTesting(false);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (!imapServer.trim()) { toast.error('IMAP server is required'); return; }
    setSaving(true);
    try {
      await onSave({ name, imapServer, imapPort, imapSecurity, username, password, passwordIsToken, characterSet, createdAt: initial?.createdAt || new Date().toISOString() });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-16 pb-8 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-400/10 flex items-center justify-center"><Mail size={16} className="text-blue-400" /></div>
            <h2 className="text-base font-semibold text-foreground">{initial ? 'Edit mail account' : 'Create new mail account'}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          <FormRow label="Name *">
            <Input value={name} onChange={e => setName(e.target.value)} autoFocus
              placeholder="e.g. Company Gmail" className="h-9 text-sm bg-muted/40 border-border" />
          </FormRow>
          <FormRow label="Username">
            <Input value={username} onChange={e => setUsername(e.target.value)}
              placeholder="email@company.com" className="h-9 text-sm bg-muted/40 border-border" />
          </FormRow>
          <FormRow label="IMAP Server *">
            <Input value={imapServer} onChange={e => setImapServer(e.target.value)}
              placeholder="imap.gmail.com" className="h-9 text-sm bg-muted/40 border-border" />
          </FormRow>
          <div>
            <FormRow label="Password">
              <Input value={password} onChange={e => setPassword(e.target.value)}
                type="password" placeholder="••••••••" className="h-9 text-sm bg-muted/40 border-border" />
            </FormRow>
            <label className="flex items-start gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={passwordIsToken} onChange={e => setPasswordIsToken(e.target.checked)}
                className="mt-0.5 accent-primary" />
              <div>
                <span className="text-xs text-foreground">Password is token</span>
                <p className="text-[11px] text-muted-foreground">Check if the password above is a token used for authentication</p>
              </div>
            </label>
          </div>
          <FormRow label="IMAP Port">
            <Input value={imapPort} onChange={e => setImapPort(e.target.value)}
              type="number" placeholder="993" className="h-9 text-sm bg-muted/40 border-border" />
          </FormRow>
          <FormRow label="Character Set">
            <Input value={characterSet} onChange={e => setCharacterSet(e.target.value)}
              placeholder="UTF-8" className="h-9 text-sm bg-muted/40 border-border" />
          </FormRow>
          <div className="col-span-2">
            <FormRow label="IMAP Security">
              <div className="max-w-xs">
                <SelectField value={imapSecurity} onChange={setImapSecurity} options={IMAP_SECURITY_OPTIONS} />
              </div>
            </FormRow>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button type="button" onClick={handleTest} disabled={testing}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-lg text-foreground hover:bg-muted/40 disabled:opacity-50 transition-colors">
            {testing ? <Loader2 size={13} className="animate-spin" /> : <TestTube2 size={13} />} Test
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2">
            {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Check size={13} /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mail Rule Modal ──────────────────────────────────────────────────────────
function RuleModal({ initial, accounts, onSave, onClose }: {
  initial?: MailRule; accounts: MailAccount[];
  onSave: (data: Omit<MailRule, 'id'>) => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [accountId, setAccountId] = useState(initial?.accountId || (accounts[0]?.id || ''));
  const [order, setOrder] = useState(initial?.order || '0');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [folder, setFolder] = useState(initial?.folder || 'INBOX');
  const [maxAgeDays, setMaxAgeDays] = useState(initial?.maxAgeDays || '');
  const [filterFrom, setFilterFrom] = useState(initial?.filterFrom || '');
  const [filterTo, setFilterTo] = useState(initial?.filterTo || '');
  const [filterSubject, setFilterSubject] = useState(initial?.filterSubject || '');
  const [filterBody, setFilterBody] = useState(initial?.filterBody || '');
  const [consumptionAction, setConsumptionAction] = useState(initial?.consumptionAction || CONSUMPTION_ACTIONS[0]);
  const [folderContentType, setFolderContentType] = useState(initial?.folderContentType || FOLDER_CONTENT_TYPES[0]);
  const [includeFilesMatching, setIncludeFilesMatching] = useState(initial?.includeFilesMatching || '');
  const [excludeFilesMatching, setExcludeFilesMatching] = useState(initial?.excludeFilesMatching || '');
  const [pdfLayout, setPdfLayout] = useState(initial?.pdfLayout || '');
  const [action, setAction] = useState(initial?.action || RULE_ACTIONS[0]);
  const [assignTags, setAssignTags] = useState(initial?.assignTags || '');
  const [assignDocumentType, setAssignDocumentType] = useState(initial?.assignDocumentType || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (!accountId) { toast.error('Select an account'); return; }
    setSaving(true);
    try {
      await onSave({ name, accountId, order, enabled, folder, maxAgeDays, filterFrom, filterTo, filterSubject, filterBody, consumptionAction, folderContentType, includeFilesMatching, excludeFilesMatching, pdfLayout, action, assignTags, assignDocumentType, createdAt: initial?.createdAt || new Date().toISOString() });
      onClose();
    } finally { setSaving(false); }
  };

  const accountName = (id: string) => accounts.find(a => a.id === id)?.name || '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-8 pb-8 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Inbox size={16} className="text-primary" /></div>
            <h2 className="text-base font-semibold text-foreground">{initial ? 'Edit mail rule' : 'Create new mail rule'}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Top row */}
          <div className="grid grid-cols-3 gap-4">
            <FormRow label="Name *">
              <Input value={name} onChange={e => setName(e.target.value)} autoFocus
                placeholder="Rule name" className="h-9 text-sm bg-muted/40 border-border" />
            </FormRow>
            <FormRow label="Account *">
              <SelectField value={accountName(accountId)}
                onChange={v => { const a = accounts.find(ac => ac.name === v); if (a) setAccountId(a.id); }}
                options={accounts.map(a => a.name)} placeholder="Select account" />
            </FormRow>
            <div>
              <FormRow label="Order">
                <Input value={order} onChange={e => setOrder(e.target.value)} type="number"
                  placeholder="0" className="h-9 text-sm bg-muted/40 border-border" />
              </FormRow>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Toggle value={enabled} onChange={setEnabled} />
            <span className="text-sm font-medium text-foreground">Enabled</span>
          </div>

          {/* Info */}
          <div className="px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-xs text-muted-foreground flex items-start gap-2">
            <Info size={13} className="shrink-0 mt-0.5 text-primary/60" />
            Paperless will only process mails that match <strong className="text-foreground">all</strong> of the criteria specified below.
          </div>

          {/* Criteria */}
          <div className="grid grid-cols-2 gap-4">
            <FormRow label="Folder">
              <Input value={folder} onChange={e => setFolder(e.target.value)}
                placeholder="INBOX" className="h-9 text-sm bg-muted/40 border-border" />
              <p className="text-[10px] text-muted-foreground mt-1">Subfolders must be separated by a delimiter, often a dot ('.') or slash ('/'), but it varies by mail server.</p>
            </FormRow>
            <FormRow label="Filter from">
              <Input value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                placeholder="sender@example.com" className="h-9 text-sm bg-muted/40 border-border" />
            </FormRow>
            <FormRow label="Maximum age (days)">
              <Input value={maxAgeDays} onChange={e => setMaxAgeDays(e.target.value)}
                type="number" placeholder="30" className="h-9 text-sm bg-muted/40 border-border" />
            </FormRow>
            <FormRow label="Filter to">
              <Input value={filterTo} onChange={e => setFilterTo(e.target.value)}
                placeholder="recipient@example.com" className="h-9 text-sm bg-muted/40 border-border" />
            </FormRow>
            <FormRow label="Consumption action">
              <SelectField value={consumptionAction} onChange={setConsumptionAction} options={CONSUMPTION_ACTIONS} />
              <p className="text-[10px] text-muted-foreground mt-1">See docs for .eml processing requirements</p>
            </FormRow>
            <FormRow label="Filter subject">
              <Input value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                placeholder="Invoice, Contract…" className="h-9 text-sm bg-muted/40 border-border" />
            </FormRow>
            <FormRow label="Folder content type">
              <SelectField value={folderContentType} onChange={setFolderContentType} options={FOLDER_CONTENT_TYPES} />
            </FormRow>
            <FormRow label="Filter body">
              <Input value={filterBody} onChange={e => setFilterBody(e.target.value)}
                placeholder="Keywords in mail body" className="h-9 text-sm bg-muted/40 border-border" />
            </FormRow>
            <FormRow label="Include only files matching">
              <Input value={includeFilesMatching} onChange={e => setIncludeFilesMatching(e.target.value)}
                placeholder="*.pdf, *invoice*" className="h-9 text-sm bg-muted/40 border-border" />
              <p className="text-[10px] text-muted-foreground mt-1">Optional. Wildcards e.g. *.pdf or *invoice* allowed. Can be comma-separated list. Case insensitive.</p>
            </FormRow>
            <FormRow label="Exclude files matching">
              <Input value={excludeFilesMatching} onChange={e => setExcludeFilesMatching(e.target.value)}
                placeholder="*.xml, *spam*" className="h-9 text-sm bg-muted/40 border-border" />
              <p className="text-[10px] text-muted-foreground mt-1">Optional. Wildcards e.g. *.pdf or *invoice* allowed. Can be comma-separated list. Case insensitive.</p>
            </FormRow>
            <FormRow label="PDF layout">
              <SelectField value={pdfLayout} onChange={setPdfLayout} options={PDF_LAYOUTS} placeholder="System default" />
            </FormRow>
            <FormRow label="Assign tags">
              <Input value={assignTags} onChange={e => setAssignTags(e.target.value)}
                placeholder="invoice, urgent, review" className="h-9 text-sm bg-muted/40 border-border" />
            </FormRow>
          </div>

          {/* Action */}
          <div className="grid grid-cols-2 gap-4">
            <FormRow label="Action">
              <SelectField value={action} onChange={setAction} options={RULE_ACTIONS} />
              <p className="text-[10px] text-muted-foreground mt-1">Only performed if the mail is processed.</p>
            </FormRow>
            <FormRow label="Assign document type">
              <Input value={assignDocumentType} onChange={e => setAssignDocumentType(e.target.value)}
                placeholder="Invoice, Contract…" className="h-9 text-sm bg-muted/40 border-border" />
            </FormRow>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !accountId}
            className="px-5 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
            {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Check size={13} /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, onAdd, addLabel }: { title: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <button onClick={onAdd}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-primary/40 text-primary rounded-lg hover:bg-primary/10 transition-colors font-medium">
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MailSettings() {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [rules, setRules] = useState<MailRule[]>([]);
  const [loading, setLoading] = useState(true);

  const [accountModal, setAccountModal] = useState<'create' | 'edit' | null>(null);
  const [editAccount, setEditAccount] = useState<MailAccount | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<MailAccount | null>(null);

  const [ruleModal, setRuleModal] = useState<'create' | 'edit' | null>(null);
  const [editRule, setEditRule] = useState<MailRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<MailRule | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    // Accounts
    const accs: MailAccount[] = [];
    try {
      const snap = await getDocs(collection(db, 'mailAccounts'));
      snap.forEach(d => accs.push({ id: d.id, ...d.data() } as MailAccount));
    } catch {}
    try {
      const local: MailAccount[] = JSON.parse(localStorage.getItem('local_mailAccounts') || '[]');
      local.forEach(a => { if (!accs.find(x => x.id === a.id)) accs.push(a); });
    } catch {}
    setAccounts(accs.sort((a, b) => a.name.localeCompare(b.name)));

    // Rules
    const rls: MailRule[] = [];
    try {
      const snap = await getDocs(collection(db, 'mailRules'));
      snap.forEach(d => rls.push({ id: d.id, ...d.data() } as MailRule));
    } catch {}
    try {
      const local: MailRule[] = JSON.parse(localStorage.getItem('local_mailRules') || '[]');
      local.forEach(r => { if (!rls.find(x => x.id === r.id)) rls.push(r); });
    } catch {}
    setRules(rls.sort((a, b) => parseInt(a.order) - parseInt(b.order)));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Account CRUD ──
  const createAccount = async (data: Omit<MailAccount, 'id'>) => {
    try {
      const ref = await addDoc(collection(db, 'mailAccounts'), data);
      toast.success(`Account "${data.name}" created`);
    } catch {
      const id = `local_${Date.now()}`;
      const local: MailAccount[] = JSON.parse(localStorage.getItem('local_mailAccounts') || '[]');
      local.push({ ...data, id });
      localStorage.setItem('local_mailAccounts', JSON.stringify(local));
      toast.success(`Account "${data.name}" saved locally`);
    }
    fetchAll();
  };

  const updateAccount = async (data: Omit<MailAccount, 'id'>) => {
    if (!editAccount) return;
    try { await updateDoc(doc(db, 'mailAccounts', editAccount.id), data as any); } catch {
      const local: MailAccount[] = JSON.parse(localStorage.getItem('local_mailAccounts') || '[]');
      const idx = local.findIndex(a => a.id === editAccount.id);
      if (idx >= 0) { local[idx] = { ...local[idx], ...data }; localStorage.setItem('local_mailAccounts', JSON.stringify(local)); }
    }
    toast.success('Account updated');
    fetchAll();
  };

  const deleteAcct = async (a: MailAccount) => {
    try { await deleteDoc(doc(db, 'mailAccounts', a.id)); } catch {}
    const local: MailAccount[] = JSON.parse(localStorage.getItem('local_mailAccounts') || '[]');
    localStorage.setItem('local_mailAccounts', JSON.stringify(local.filter(x => x.id !== a.id)));
    setAccounts(prev => prev.filter(x => x.id !== a.id));
    setDeleteAccount(null);
    toast.success(`Account "${a.name}" deleted`);
  };

  // ── Rule CRUD ──
  const createRule = async (data: Omit<MailRule, 'id'>) => {
    try {
      await addDoc(collection(db, 'mailRules'), data);
    } catch {
      const id = `local_${Date.now()}`;
      const local: MailRule[] = JSON.parse(localStorage.getItem('local_mailRules') || '[]');
      local.push({ ...data, id });
      localStorage.setItem('local_mailRules', JSON.stringify(local));
    }
    toast.success(`Rule "${data.name}" created`);
    fetchAll();
  };

  const updateRule = async (data: Omit<MailRule, 'id'>) => {
    if (!editRule) return;
    try { await updateDoc(doc(db, 'mailRules', editRule.id), data as any); } catch {
      const local: MailRule[] = JSON.parse(localStorage.getItem('local_mailRules') || '[]');
      const idx = local.findIndex(r => r.id === editRule.id);
      if (idx >= 0) { local[idx] = { ...local[idx], ...data }; localStorage.setItem('local_mailRules', JSON.stringify(local)); }
    }
    toast.success('Rule updated');
    fetchAll();
  };

  const deleteRl = async (r: MailRule) => {
    try { await deleteDoc(doc(db, 'mailRules', r.id)); } catch {}
    const local: MailRule[] = JSON.parse(localStorage.getItem('local_mailRules') || '[]');
    localStorage.setItem('local_mailRules', JSON.stringify(local.filter(x => x.id !== r.id)));
    setRules(prev => prev.filter(x => x.id !== r.id));
    setDeleteRule(null);
    toast.success(`Rule "${r.name}" deleted`);
  };

  const accountName = (id: string) => accounts.find(a => a.id === id)?.name || '—';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <div className="w-9 h-9 rounded-lg bg-blue-400/10 flex items-center justify-center">
          <Mail size={18} className="text-blue-400" />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-foreground">Mail Settings</h1>
          <Info size={13} className="text-muted-foreground" title="Configure IMAP mail accounts and rules for automatic document ingestion" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : (
          <>
            {/* ── Mail Accounts ── */}
            <div>
              <SectionHeader title="Mail accounts" onAdd={() => { setAccountModal('create'); setEditAccount(null); }} addLabel="Add Account" />
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Server</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Username</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {accounts.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">No mail accounts defined.</td></tr>
                    ) : accounts.map(a => (
                      <tr key={a.id} className="group hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{a.name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{a.imapServer}:{a.imapPort}</td>
                        <td className="px-4 py-3 text-muted-foreground">{a.username}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditAccount(a); setAccountModal('edit'); }}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil size={13} /></button>
                            <button onClick={() => setDeleteAccount(a)}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Mail Rules ── */}
            <div>
              <SectionHeader title="Mail rules" onAdd={() => { setRuleModal('create'); setEditRule(null); }} addLabel="Add Rule" />
              {accounts.length === 0 && (
                <div className="mb-3 flex items-center gap-2 px-4 py-2.5 bg-amber-400/10 border border-amber-400/30 rounded-xl text-xs text-amber-400">
                  <Info size={13} /> Add a mail account first before creating rules.
                </div>
              )}
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sort Order</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Account</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Processed Mail</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rules.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">No mail rules defined.</td></tr>
                    ) : rules.map(r => (
                      <tr key={r.id} className="group hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.order}</td>
                        <td className="px-4 py-3 text-muted-foreground">{accountName(r.accountId)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${r.enabled ? 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30' : 'bg-muted text-muted-foreground border-border'}`}>
                            {r.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">—</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditRule(r); setRuleModal('edit'); }}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil size={13} /></button>
                            <button onClick={() => setDeleteRule(r)}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {(accountModal === 'create' || accountModal === 'edit') && (
        <AccountModal initial={accountModal === 'edit' ? editAccount ?? undefined : undefined}
          onSave={accountModal === 'create' ? createAccount : updateAccount}
          onClose={() => { setAccountModal(null); setEditAccount(null); }} />
      )}
      {(ruleModal === 'create' || ruleModal === 'edit') && (
        <RuleModal initial={ruleModal === 'edit' ? editRule ?? undefined : undefined}
          accounts={accounts}
          onSave={ruleModal === 'create' ? createRule : updateRule}
          onClose={() => { setRuleModal(null); setEditRule(null); }} />
      )}
      {deleteAccount && <ConfirmDialog name={deleteAccount.name} onConfirm={() => deleteAcct(deleteAccount)} onCancel={() => setDeleteAccount(null)} />}
      {deleteRule && <ConfirmDialog name={deleteRule.name} onConfirm={() => deleteRl(deleteRule)} onCancel={() => setDeleteRule(null)} />}
    </div>
  );
}
