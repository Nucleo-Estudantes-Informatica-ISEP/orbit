'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  content: string;
  read: boolean;
  createdAt: string;
}

const typeToHref: Record<string, string> = {
  TASK_ASSIGNED: '/dashboard/tasks',
  ANNOUNCEMENT: '/dashboard/announcements',
  EVENT: '/dashboard/events',
  RECRUITMENT: '/dashboard/recruitment',
  ROLE_CHANGED: '/dashboard/people',
};

export function NotificationBell({ isCollapsed }: { isCollapsed?: boolean }) {
  const { user } = useAuth();
  const { t, formatDate } = useLocale();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.get<Notification[]>('/announcements/me');
      setNotifications(data);
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const preview = notifications.slice(0, 5);

  const handleMarkRead = async (id: string) => {
    try {
      await api.put(`/announcements/${id}/read`, {});
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    } catch {}
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground hover:bg-muted"
          title={t('notifications.title')}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-[calc(100vw-2rem)] sm:w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <span className="text-sm font-semibold">{t('notifications.title')}</span>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">{unreadCount} {t('notifications.new')}</Badge>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {preview.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('notifications.empty')}</p>
          ) : (
            preview.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  handleMarkRead(n.id);
                  setOpen(false);
                  const href = typeToHref[n.type] || '/dashboard/announcements';
                  router.push(href);
                }}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-border/40 last:border-0 transition-colors',
                  'hover:bg-muted/50',
                  !n.read && 'bg-primary/5',
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  <div className={cn(!n.read ? '' : 'ml-3.5')}>
                    <p className="text-xs text-foreground line-clamp-2">{n.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDate(n.createdAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
        <Separator className="bg-border/40" />
        <div className="p-2">
          <Link
            href="/dashboard/announcements"
            onClick={() => setOpen(false)}
            className="block w-full text-center text-xs text-primary hover:underline py-1"
          >
            {t('notifications.viewAll')}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
