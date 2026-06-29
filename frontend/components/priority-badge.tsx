'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

const config: Record<Priority, { label: string; className: string }> = {
  LOW: { label: 'Low', className: 'bg-muted text-muted-foreground border-border/40' },
  MEDIUM: { label: 'Medium', className: 'bg-primary/10 text-primary border-primary/30' },
  HIGH: { label: 'High', className: 'bg-orange-500/10 text-orange-600 border-orange-500/30 dark:text-orange-400' },
  URGENT: { label: 'Urgent', className: 'bg-destructive/10 text-destructive border-destructive/30' },
};

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const { label, className: clx } = config[priority] ?? config.MEDIUM;
  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold uppercase tracking-wider', clx, className)}>
      {label}
    </Badge>
  );
}
