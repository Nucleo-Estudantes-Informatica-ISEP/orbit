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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Loader2 } from 'lucide-react';

interface RoleOption {
  id: string;
  name: string;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
  departmentId?: string;
  active?: boolean;
}

interface EditUserDialogProps {
  user: User | null; // null = Add Mode, User = Edit Mode
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (user: Partial<User> & { password?: string }) => Promise<void>;
  roles: RoleOption[];
  departments: DepartmentOption[];
}

export function EditUserDialog({ user, open, onOpenChange, onSave, roles, departments }: EditUserDialogProps) {
  const isAddMode = !user;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'USER',
    departmentId: '',
    password: '',
    confirmPassword: '',
    active: true,
  });
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Update form data when modal opens/changes
  useEffect(() => {
    if (open) {
      setFormData({
        name: user?.name || '',
        email: user?.email || '',
        role: user?.roles?.[0] || 'USER',
        departmentId: user?.departmentId || '',
        password: '',
        confirmPassword: '',
        active: user ? user.active !== false : true,
      });
      setError('');
    }
  }, [user, open]);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setError('');

    if (!formData.name || !formData.email) {
      setError('Name and email are required');
      return;
    }

    if (!formData.departmentId) {
      setError('Department is required');
      return;
    }

    if (isAddMode && !formData.password) {
      setError('Password is required for new users');
      return;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await onSave({
        id: user?.id,
        name: formData.name,
        email: formData.email,
        roles: [formData.role],
        departmentId: formData.departmentId,
        active: formData.active,
        password: formData.password || undefined,
      });
      // Fecho automático tratado fora ou através do onOpenChange local
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isAddMode ? 'create' : 'save'} user`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background border-border/40">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isAddMode ? 'Add New User' : 'Edit User'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isAddMode 
              ? 'Create a new user account and assign roles.' 
              : 'Update user information and permissions.'}
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
            <Label htmlFor="name" className="text-foreground">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Full name"
              disabled={isLoading}
              className="bg-background border-border/50 focus-visible:ring-primary/50"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email" className="text-foreground">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="user@example.com"
              disabled={isLoading || (!isAddMode && false)} // Depende de deixares editar o email
              className="bg-background border-border/50 focus-visible:ring-primary/50"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role" className="text-foreground">Role</Label>
            <Select value={formData.role} onValueChange={(value) => handleChange('role', value)} disabled={isLoading}>
              <SelectTrigger id="role" className="bg-background border-border/50 focus-visible:ring-primary/50">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.length > 0 ? (
                  roles.map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="USER">USER</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="department" className="text-foreground">Department</Label>
            <Select value={formData.departmentId} onValueChange={(value) => handleChange('departmentId', value)} disabled={isLoading}>
              <SelectTrigger id="department" className="bg-background border-border/50 focus-visible:ring-primary/50">
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent>
                {departments.length > 0 ? (
                  departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No departments available</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 mt-2">
            <Label htmlFor="password" className="text-foreground">
              {isAddMode ? 'Password' : 'New Password (optional)'}
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder={isAddMode ? 'Secure password' : 'Leave empty to keep current'}
              disabled={isLoading}
              className="bg-background border-border/50 focus-visible:ring-primary/50"
            />
          </div>

          {formData.password && (
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                placeholder="Confirm password"
                disabled={isLoading}
                className="bg-background border-border/50 focus-visible:ring-primary/50"
              />
            </div>
          )}

          <div className="flex items-center space-x-2 mt-2">
            <Checkbox
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => handleChange('active', checked as boolean)}
              disabled={isLoading}
            />
            <Label htmlFor="active" className="text-sm font-medium leading-none cursor-pointer text-foreground">
              Active account
            </Label>
          </div>
        </div>

        <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="border-border/50 w-full">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isAddMode ? 'Creating...' : 'Saving...'}
              </>
            ) : (
              isAddMode ? 'Create User' : 'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}