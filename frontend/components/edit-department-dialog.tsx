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
  const isAddMode = !department;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Update form data when modal opens/changes
  useEffect(() => {
    if (open) {
      setFormData({
        name: department?.name || '',
        description: department?.description || '',
      });
      setError('');
    }
  }, [department, open]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setError('');

    if (!formData.name || !formData.name.trim()) {
      setError('Department name is required');
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
      setError(err instanceof Error ? err.message : `Failed to ${isAddMode ? 'create' : 'save'} department`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background border-border/40">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isAddMode ? 'Add New Department' : 'Edit Department'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isAddMode
              ? 'Create a new department for your organization.'
              : 'Update department information.'}
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
              Department Name
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Engineering"
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
              placeholder="Brief description of this department"
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
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isAddMode ? 'Creating...' : 'Saving...'}
              </>
            ) : (
              isAddMode ? 'Create Department' : 'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
