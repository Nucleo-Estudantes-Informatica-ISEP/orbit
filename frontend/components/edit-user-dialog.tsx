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
import { useLocale } from '@/lib/locale-context';
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
  const { t } = useLocale();
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
    if (!open) return;
    const timeoutId = window.setTimeout(() => {
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
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [user, open]);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setError('');

    if (!formData.name || !formData.email) {
      setError(t('people.nameRequired'));
      return;
    }

    if (!formData.departmentId) {
      setError(t('people.departmentRequired'));
      return;
    }

    if (isAddMode && !formData.password) {
      setError(t('people.passwordRequired'));
      return;
    }

    if (formData.password && formData.password.length < 8) {
      setError(t('people.passwordLength'));
      return;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      setError(t('people.passwordMismatch'));
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
      setError(err instanceof Error ? err.message : isAddMode ? t('people.failedToCreate') : t('people.failedToSave'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isAddMode ? t('people.addNewUser') : t('people.editUser')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isAddMode 
              ? t('people.createUserDescription') 
              : t('people.editUserDescription')}
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
            <Label htmlFor="name" className="text-foreground">{t('common.name')}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={t('common.fullName')}
              disabled={isLoading}
              className="bg-background border-border/50 focus-visible:ring-primary/50"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email" className="text-foreground">{t('common.email')}</Label>
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
            <Label htmlFor="role" className="text-foreground">{t('people.role')}</Label>
            <Select value={formData.role} onValueChange={(value) => handleChange('role', value)} disabled={isLoading}>
              <SelectTrigger id="role" className="bg-background border-border/50 focus-visible:ring-primary/50">
                <SelectValue placeholder={t('people.selectRole')} />
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
            <Label htmlFor="department" className="text-foreground">{t('common.department')}</Label>
            <Select value={formData.departmentId} onValueChange={(value) => handleChange('departmentId', value)} disabled={isLoading}>
              <SelectTrigger id="department" className="bg-background border-border/50 focus-visible:ring-primary/50">
                <SelectValue placeholder={t('common.select')} />
              </SelectTrigger>
              <SelectContent>
                {departments.length > 0 ? (
                  departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">{t('people.noDepartments')}</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 mt-2">
            <Label htmlFor="password" className="text-foreground">
              {isAddMode ? t('common.password') : t('people.newPasswordOptional')}
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder={isAddMode ? t('people.passwordSecurePlaceholder') : t('people.keepCurrentPassword')}
              disabled={isLoading}
              className="bg-background border-border/50 focus-visible:ring-primary/50"
            />
          </div>

          {formData.password && (
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword" className="text-foreground">{t('common.confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                placeholder={t('common.confirmPassword')}
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
              {t('people.activeAccount')}
            </Label>
          </div>
        </div>

        <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="border-border/50 w-full">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isAddMode ? t('common.creating') : t('common.saving')}
              </>
            ) : (
              isAddMode ? t('people.createUser') : t('people.saveChanges')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
