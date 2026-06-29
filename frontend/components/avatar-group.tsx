'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Person {
  id: string;
  name: string;
}

interface AvatarGroupProps {
  people: Person[];
  max?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function AvatarGroup({ people, max = 3, size = 'sm', className }: AvatarGroupProps) {
  const visible = people.slice(0, max);
  const overflow = people.length - max;
  const sizeClass = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs';

  return (
    <div className={cn('flex -space-x-1.5', className)}>
      {visible.map((p) => (
        <Avatar key={p.id} className={cn(sizeClass, 'border-2 border-background ring-0')}>
          <AvatarFallback className="bg-primary/20 text-primary font-semibold">
            {p.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <div className={cn(sizeClass, 'flex items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground font-semibold')}>
          +{overflow}
        </div>
      )}
    </div>
  );
}
