'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useLocale } from '@/lib/locale-context';

interface KanbanColumnProps {
  id: string;
  title: string;
  count: number;
  color?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  maxVisible?: number;
}

export function KanbanColumn({ id, title, count, color, children, headerAction, maxVisible = 0 }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);

  const childrenArray = Array.isArray(children) ? children : [children];
  const hasLimit = maxVisible > 0 && childrenArray.length > maxVisible;
  const visible = hasLimit && !expanded ? childrenArray.slice(0, maxVisible) : childrenArray;
  const hidden = childrenArray.length - maxVisible;

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
          {visible}
        </SortableContext>
        {hasLimit && (
          <Button variant="ghost" size="sm" className="w-full mt-1 text-xs text-muted-foreground" onClick={() => setExpanded(!expanded)}>
            {expanded ? (
              <><ChevronUp className="h-3.5 w-3.5 mr-1" />{t('kanban.showLess')}</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5 mr-1" />{t('kanban.showMore').replace('{count}', String(hidden))}</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
