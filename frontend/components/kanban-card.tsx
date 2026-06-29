'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface KanbanCardProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function KanbanCard({ id, children, className, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-background border border-border/40 rounded-lg p-3 cursor-pointer',
        'hover:border-primary/40 hover:shadow-sm transition-all duration-150',
        isDragging && 'opacity-50 shadow-lg scale-[1.02] z-50',
        className,
      )}
    >
      {children}
    </div>
  );
}
