'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Loader2 } from 'lucide-react';
import { formatSystemPermission, permissionGroups, systemPermissions, type SystemPermission } from '@/lib/system-permissions';

interface Role {
  id: string;
  name: string;
  description?: string | null;
  permissions: SystemPermission[];
}

interface EditRoleDialogProps {
  role: Role | null; // null = Add Mode, Role = Edit Mode
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (role: Partial<Role>) => Promise<void>;
}

export function EditRoleDialog({ role, open, onOpenChange, onSave }: EditRoleDialogProps) {
  const isAddMode = !role;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as SystemPermission[],
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Update form data when modal opens/changes
  useEffect(() => {
    if (open) {
      setFormData({
        name: role?.name || '',
        description: role?.description || '',
        permissions: role?.permissions || [],
      });
      setError('');
    }
  }, [role, open]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const togglePermission = (permission: SystemPermission, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, permission]
        : prev.permissions.filter((item) => item !== permission),
    }));
  };

  const handleSave = async () => {
    setError('');

    if (!formData.name || !formData.name.trim()) {
      setError('Role name is required');
      return;
    }

    setIsLoading(true);
    try {
      await onSave({
        id: role?.id,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        permissions: formData.permissions,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isAddMode ? 'create' : 'save'} role`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background border-border/40">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isAddMode ? 'Add New Role' : 'Edit Role'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isAddMode
              ? 'Create a new role for the platform.'
              : 'Update role information.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name" className="text-foreground">
              Role Name
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. COORDINATOR"
              disabled={isLoading}
              className="bg-background border-border/50 focus-visible:ring-primary/50"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description" className="text-foreground">
              Description
            </Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of this role"
              disabled={isLoading}
              className="bg-background border-border/50 focus-visible:ring-primary/50"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-foreground">Permissions</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormData((prev) => ({ ...prev, permissions: [...systemPermissions] }))}
                disabled={isLoading}
                className="border-border/50"
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFormData((prev) => ({ ...prev, permissions: [] }))}
                disabled={isLoading || formData.permissions.length === 0}
              >
                Deselect all
              </Button>
            </div>
            <div className="space-y-4 rounded-lg border border-border/50 bg-muted/20 p-3 max-h-[360px] overflow-y-auto">
              {permissionGroups.map((group) => (
                <div key={group.label} className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                    {group.label}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.permissions.map((permission) => (
                      <label key={permission} className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={formData.permissions.includes(permission)}
                          onCheckedChange={(checked) => togglePermission(permission, checked === true)}
                          disabled={isLoading}
                        />
                        <span>{formatSystemPermission(permission)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="border-border/50 w-full"
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isAddMode ? 'Creating...' : 'Saving...'}
              </>
            ) : (
              isAddMode ? 'Create Role' : 'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
