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
import { useLocale } from '@/lib/locale-context';
import { AlertCircle, Loader2 } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  description?: string | null;
}

interface EditDepartmentDialogProps {
  department: Department | null; // null = Add Mode, Department = Edit Mode
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (department: Partial<Department>) => Promise<void>;
}

export function EditDepartmentDialog({ department, open, onOpenChange, onSave }: EditDepartmentDialogProps) {
  const { t } = useLocale();
  const isAddMode = !department;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Update form data when modal opens/changes
  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(() => {
      setFormData({
        name: department?.name || '',
        description: department?.description || '',
      });
      setError('');
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [department, open]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setError('');

    if (!formData.name || !formData.name.trim()) {
      setError(t('departments.nameRequired'));
      return;
    }

    setIsLoading(true);
    try {
      await onSave({
        id: department?.id,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : isAddMode ? t('departments.failedToCreate') : t('departments.failedToSave'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isAddMode ? t('departments.addNew') : t('departments.edit')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isAddMode
              ? t('departments.createDescription')
              : t('departments.editDescription')}
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
              {t('common.name')}
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={t('departments.namePlaceholder')}
              disabled={isLoading}
              className="bg-background border-border/50 focus-visible:ring-primary/50"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description" className="text-foreground">
              {t('common.description')}
            </Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={t('departments.descriptionPlaceholder')}
              disabled={isLoading}
              className="bg-background border-border/50 focus-visible:ring-primary/50"
            />
          </div>
        </div>

        <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="border-border/50 w-full"
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isAddMode ? t('common.creating') : t('common.saving')}
              </>
            ) : (
              isAddMode ? t('departments.createDepartment') : t('departments.saveChanges')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
