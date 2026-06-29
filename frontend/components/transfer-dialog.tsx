'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/lib/locale-context';
import { AlertCircle, Loader2 } from 'lucide-react';

interface TransferOption {
  id: string;
  name: string;
}

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  userCount: number;
  currentItemName: string;
  transferOptions: TransferOption[];
  isLoading?: boolean;
  onConfirm: (selectedId: string) => Promise<void>;
}

export function TransferDialog({
  open,
  onOpenChange,
  title,
  description,
  userCount,
  currentItemName,
  transferOptions,
  isLoading = false,
  onConfirm,
}: TransferDialogProps) {
  const { t } = useLocale();
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedOption('');
      setIsProcessing(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!selectedOption) return;
    setIsProcessing(true);
    try {
      await onConfirm(selectedOption);
      onOpenChange(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-background border-border/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-500">
          <strong>{userCount}</strong> {userCount === 1 ? t('transfer.userIsAssociated') : t('transfer.usersAssociated')} <strong>"{currentItemName}"</strong>.{userCount > 0 ? ` ${t('transfer.selectWhere')}` : ''}
        </div>

        {userCount > 0 && (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="transfer-select" className="text-foreground">
                {t('transfer.to')}
              </Label>
              <Select value={selectedOption} onValueChange={setSelectedOption} disabled={isProcessing}>
                <SelectTrigger id="transfer-select" className="bg-background border-border/50 focus-visible:ring-primary/50">
                  <SelectValue placeholder={t('transfer.selectDestination')} />
                </SelectTrigger>
                <SelectContent>
                  {transferOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="border-border/50 w-full"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || userCount === 0 || !selectedOption}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('transfer.transferring')}
              </>
            ) : (
              t('transfer.transferAndDelete')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
