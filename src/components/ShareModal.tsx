import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Search, UserCheck, UserPlus, Loader2, Shield, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface ShareModalProps {
  docObj: any;
  open: boolean;
  onClose: () => void;
  onPermissionsUpdated?: () => void;
}

interface FoundUser {
  uid: string;
  name: string;
  email: string;
  employeeId: string;
  department: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  edit: 'Editor',
  view: 'Viewer',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  edit: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  view: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export default function ShareModal({ docObj, open, onClose, onPermissionsUpdated }: ShareModalProps) {
  const { currentUser, userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoundUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'view' | 'edit'>('view');
  const [isSaving, setIsSaving] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, string>>(docObj?.permissions || {});
  const [userInfoMap, setUserInfoMap] = useState<Record<string, FoundUser>>({});
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load info for all users who already have permissions
  useEffect(() => {
    if (!open) return;
    const currentPerms = docObj?.permissions || {};
    setPermissions(currentPerms);
    loadUsersInfo(Object.keys(currentPerms));
  }, [open, docObj]);

  const loadUsersInfo = async (uids: string[]) => {
    if (uids.length === 0) return;
    try {
      const results: Record<string, FoundUser> = {};
      // Query in batches of 10
      const chunks = [];
      for (let i = 0; i < uids.length; i += 10) {
        chunks.push(uids.slice(i, i + 10));
      }
      for (const chunk of chunks) {
        const q = query(collection(db, 'users'), where('uid', 'in', chunk));
        const snap = await getDocs(q);
        snap.forEach((d) => {
          const data = d.data() as FoundUser;
          results[data.uid] = data;
        });
      }
      setUserInfoMap(results);
    } catch (err) {
      console.warn('Could not load user info for permissions list:', err);
    }
  };

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!val.trim() || val.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const found: FoundUser[] = [];
        const term = val.trim().toUpperCase();

        // Search by employeeId prefix
        const empQuery = query(
          collection(db, 'users'),
          where('employeeId', '>=', term),
          where('employeeId', '<=', term + '\uf8ff')
        );
        const empSnap = await getDocs(empQuery);
        empSnap.forEach((d) => {
          const data = d.data() as FoundUser;
          if (data.uid !== currentUser?.uid && !found.find((f) => f.uid === data.uid)) {
            found.push(data);
          }
        });

        // Search by email prefix (lowercase)
        const emailTerm = val.trim().toLowerCase();
        const emailQuery = query(
          collection(db, 'users'),
          where('email', '>=', emailTerm),
          where('email', '<=', emailTerm + '\uf8ff')
        );
        const emailSnap = await getDocs(emailQuery);
        emailSnap.forEach((d) => {
          const data = d.data() as FoundUser;
          if (data.uid !== currentUser?.uid && !found.find((f) => f.uid === data.uid)) {
            found.push(data);
          }
        });

        setSearchResults(found);
      } catch (err) {
        console.error('User search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const handleAddPermission = async (user: FoundUser) => {
    const newPerms = { ...permissions, [user.uid]: selectedRole };
    await savePermissions(newPerms);
    setUserInfoMap((prev) => ({ ...prev, [user.uid]: user }));
    setSearchQuery('');
    setSearchResults([]);
    toast.success(`${user.name || user.email} added as ${ROLE_LABELS[selectedRole]}.`);
  };

  const handleRoleChange = async (uid: string, newRole: string) => {
    if (newRole === 'remove') {
      const newPerms = { ...permissions };
      delete newPerms[uid];
      await savePermissions(newPerms);
      toast.success('Access removed.');
    } else {
      const newPerms = { ...permissions, [uid]: newRole };
      await savePermissions(newPerms);
      toast.success('Permission updated.');
    }
  };

  const savePermissions = async (newPerms: Record<string, string>) => {
    setIsSaving(true);
    try {
      setPermissions(newPerms);
      if (docObj?.id && !docObj.id.startsWith('local_') && !docObj.id.match(/^[0-9]$/)) {
        await updateDoc(doc(db, 'documents', docObj.id), { permissions: newPerms });
      }
      // Also update local storage if applicable
      if (docObj?.id?.startsWith('local_') || docObj?.id?.match(/^[0-9]/)) {
        const localDocs = JSON.parse(localStorage.getItem('local_documents') || '[]');
        const idx = localDocs.findIndex((d: any) => d.id === docObj.id);
        if (idx !== -1) {
          localDocs[idx].permissions = newPerms;
          localStorage.setItem('local_documents', JSON.stringify(localDocs));
        }
      }
      onPermissionsUpdated?.();
    } catch (err: any) {
      toast.error(`Failed to update permissions: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const isOwner =
    docObj?.permissions?.[currentUser?.uid || ''] === 'owner' ||
    docObj?.uploadedBy === currentUser?.email;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-[#0F1224] border-border text-foreground shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Share Document</DialogTitle>
              <p className="text-[11px] text-muted-foreground truncate max-w-[320px]" title={docObj?.name}>
                {docObj?.name}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Search for employee */}
          {isOwner && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Add People
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search by Employee ID or email..."
                    className="pl-8 bg-secondary/50 border-border text-sm h-9"
                  />
                </div>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'view' | 'edit')}>
                  <SelectTrigger className="w-28 bg-secondary/50 border-border h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Viewer</SelectItem>
                    <SelectItem value="edit">Editor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Results */}
              {isSearching && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Searching employees...
                </div>
              )}
              {!isSearching && searchResults.length > 0 && (
                <div className="border border-border/50 rounded-lg bg-[#12162B] divide-y divide-border/30 overflow-hidden">
                  {searchResults.map((user) => (
                    <div
                      key={user.uid}
                      className="flex items-center justify-between px-3 py-2 hover:bg-secondary/20 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {user.name || user.email}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {user.employeeId} • {user.department} • {user.email}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-3 h-7 text-xs border-primary/40 text-primary hover:bg-primary/10 shrink-0"
                        onClick={() => handleAddPermission(user)}
                        disabled={isSaving || !!permissions[user.uid]}
                      >
                        {permissions[user.uid] ? (
                          <><UserCheck className="w-3 h-3 mr-1" /> Added</>
                        ) : (
                          <><UserPlus className="w-3 h-3 mr-1" /> Add</>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground px-1">
                  No employees found. Make sure they have logged into DG Repo first.
                </p>
              )}
            </div>
          )}

          {/* Who Has Access */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3 h-3" /> Who Has Access
            </label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
            {(Object.entries(permissions) as [string, string][]).map(([uid, role]) => {
                const info = userInfoMap[uid];
                const isCurrentUser = uid === currentUser?.uid;
                return (
                  <div
                    key={uid}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/20 border border-border/40"
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {(info?.name || info?.email || 'U')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {info?.name || info?.email || uid}
                          {isCurrentUser && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">(You)</span>
                          )}
                        </p>
                        {info && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {info.employeeId} • {info.department}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${ROLE_COLORS[role] || ROLE_COLORS.view}`}
                      >
                        {ROLE_LABELS[role] || role}
                      </Badge>
                      {isOwner && !isCurrentUser && role !== 'owner' && (
                        <Select
                          value={role}
                          onValueChange={(v) => handleRoleChange(uid, v)}
                        >
                          <SelectTrigger className="h-6 w-[80px] text-[10px] bg-secondary/50 border-border/50 px-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">Viewer</SelectItem>
                            <SelectItem value="edit">Editor</SelectItem>
                            <SelectItem value="remove">
                              <span className="text-destructive flex items-center gap-1">
                                <Trash2 className="w-3 h-3" /> Remove
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                );
              })}
              {Object.keys(permissions).length === 0 && (
                <p className="text-xs text-muted-foreground italic px-1 py-2">
                  No specific permissions set. Document is visible based on its confidentiality level.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={onClose} className="border-border text-foreground">
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
