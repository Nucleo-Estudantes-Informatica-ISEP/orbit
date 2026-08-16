'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocale } from '@/lib/locale-context';
import { AlertCircle, Loader2 } from 'lucide-react';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  itemName?: string;
  isLoading?: boolean;
  onConfirm: () => Promise<void>;
  isDangerous?: boolean;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  itemName,
  isLoading = false,
  onConfirm,
  isDangerous = false,
}: DeleteConfirmDialogProps) {
  const { t } = useLocale();
  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-background border-border/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {description}
            {itemName && <span className="font-semibold text-foreground block mt-2">&quot;{itemName}&quot;</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
          {t('common.cannotUndo')}
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
          <Button
            variant={isDangerous ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.deleting')}
              </>
            ) : (
              t('common.delete')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
