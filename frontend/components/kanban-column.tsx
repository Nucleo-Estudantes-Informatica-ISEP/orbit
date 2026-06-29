'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface KanbanColumnProps {
  id: string;
  title: string;
  count: number;
  color?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}

export function KanbanColumn({ id, title, count, color, children, headerAction }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col min-w-[280px] w-[280px] shrink-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          {color && <div className={cn('h-2.5 w-2.5 rounded-full', color)} />}
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{count}</Badge>
        </div>
        {headerAction}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 min-h-[200px] rounded-xl p-2 transition-colors',
          'bg-muted/30 border border-border/40',
          isOver && 'bg-primary/5 border-primary/30',
        )}
      >
        <SortableContext items={[]} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
      </div>
    </div>
  );
}
