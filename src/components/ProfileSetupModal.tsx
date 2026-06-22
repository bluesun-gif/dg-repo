import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { BadgeCheck, User } from 'lucide-react';
import { toast } from 'sonner';

const DEPARTMENTS = ['Sales', 'Technical', 'Finance', 'Legal', 'HR', 'Operations', 'IT', 'Other'];

export default function ProfileSetupModal() {
  const { userProfile, updateProfile } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [name, setName] = useState(userProfile?.name || '');
  const [saving, setSaving] = useState(false);

  // Only show if profile is missing an employee ID
  const needsSetup = userProfile && !userProfile.employeeId;

  const handleSave = async () => {
    if (!employeeId.trim()) {
      toast.error('Employee ID is required.');
      return;
    }
    if (!department) {
      toast.error('Please select your department.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        employeeId: employeeId.trim().toUpperCase(),
        department,
        name: name.trim() || userProfile?.name || '',
      });
      toast.success('Profile set up successfully! Welcome to DG Repo.');
    } catch (err: any) {
      toast.error(`Failed to save profile: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!needsSetup) return null;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md bg-[#0F1224] border-border text-foreground shadow-2xl"
        // Prevent closing by clicking outside or pressing Escape
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Complete Your Profile</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Required to use DG Repo. This is stored securely.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Full Name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="bg-secondary/50 border-border"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-emp-id">
              Employee ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="profile-emp-id"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="e.g. EMP-001"
              className="bg-secondary/50 border-border font-mono"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Your unique company Employee ID (e.g. EMP-042 or DG-2024-001).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>
              Department <span className="text-destructive">*</span>
            </Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="bg-secondary/50 border-border">
                <SelectValue placeholder="Select your department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-muted-foreground">
            <span className="text-primary font-semibold">Why is this needed?</span>{' '}
            Other employees will search for you by Employee ID or email when sharing documents.
            Your department helps filter document access.
          </div>

          <Button
            className="w-full font-semibold mt-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : (
              <>
                <BadgeCheck className="w-4 h-4 mr-2" /> Complete Setup & Enter DG Repo
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
