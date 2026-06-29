'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Briefcase, Calendar, CheckSquare, ArrowRight, Clock, Megaphone, CreditCard,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useLocale } from '@/lib/locale-context';
import { usePermission } from '@/lib/use-permission';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  deadline?: string;
}

interface Event {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
}

interface Candidate {
  id: string;
  stage: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  createdBy?: { id: string; name: string };
}

interface Project {
  id: string;
}

interface Debt {
  value: string | number;
  status: 'PENDING' | 'COMPLETED';
  type: 'INCOME' | 'OUTCOME';
}

const priorityColors: Record<string, string> = {
  LOW: 'text-muted-foreground',
  MEDIUM: 'text-primary',
  HIGH: 'text-orange-500',
  URGENT: 'text-destructive',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const canViewProjects = usePermission('PROJECTS_VIEW');
  const canViewEvents = usePermission('EVENTS_VIEW');
  const canViewTasks = usePermission('TASKS_VIEW');
  const canViewDebts = usePermission('DEBTS_VIEW');
  const canViewAnnouncements = usePermission('ANNOUNCEMENTS_VIEW');

  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const statusLabels: Record<string, string> = {
    TODO: t('tasks.todo'),
    IN_PROGRESS: t('tasks.inProgress'),
    BLOCKED: t('tasks.blocked'),
    DONE: t('tasks.done'),
  };

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get<Task[]>(`/tasks?assigneeId=${user.id}`).catch(() => []),
      api.get<Project[]>('/projects').catch(() => []),
      api.get<Debt[]>('/debts').catch(() => []),
      api.get<{ items: Event[]; total: number }>(`/events?page=1&pageSize=3&filter=UPCOMING`).catch(() => ({ items: [] as Event[] })),
      api.get<Candidate[]>('/candidates').catch(() => []),
      api.get<{ items: Announcement[]; total: number }>(`/announcements?page=1&pageSize=5&visibility=ALL`).catch(() => ({ items: [] as Announcement[] })),
    ]).then(([tasksRaw, p, d, eResp, c, annResp]) => {
      const taskArr: Task[] = Array.isArray(tasksRaw) ? tasksRaw : [];
      setMyTasks(taskArr.filter((task) => task.status !== 'DONE').slice(0, 5));
      setProjects(Array.isArray(p) ? p as Project[] : []);
      setDebts(Array.isArray(d) ? d as Debt[] : []);
      const now = new Date();
      const evArr: Event[] = Array.isArray(eResp) ? eResp as Event[] : (eResp as { items?: Event[] })?.items ?? [];
      setEvents(evArr.filter((ev) => new Date(ev.startDate) >= now).slice(0, 3));
      setCandidates(Array.isArray(c) ? c as Candidate[] : []);
      const annArr: Announcement[] = Array.isArray(annResp) ? annResp as Announcement[] : (annResp as { items?: Announcement[] })?.items ?? [];
      setAnnouncements(annArr.slice(0, 5));
      setLoading(false);
    });
  }, [user]);

  const pendingDebts = debts.filter((debt) => debt.status !== 'COMPLETED');
  const debtBalance = pendingDebts.reduce((sum, debt) => {
    const value = Number(debt.value);
    return sum + (debt.type === 'INCOME' ? value : -value);
  }, 0);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

  const recruitmentStages = ['RECEIVED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED'];
  const stageCounts = recruitmentStages.reduce((acc, stage) => {
    acc[stage] = candidates.filter((c) => c.stage === stage).length;
    return acc;
  }, {} as Record<string, number>);

  const statCards = [
    canViewProjects ? { icon: Briefcase, label: t('dashboard.projectsCount'), value: loading ? '—' : String(projects.length), href: '/dashboard/projects' } : null,
    canViewEvents ? { icon: Calendar, label: t('dashboard.upcomingEventsCount'), value: loading ? '—' : String(events.length), href: '/dashboard/events' } : null,
    canViewTasks ? { icon: CheckSquare, label: t('dashboard.myTasksCount'), value: loading ? '—' : String(myTasks.length), href: '/dashboard/tasks' } : null,
    canViewDebts ? { icon: CreditCard, label: t('dashboard.debtBalance'), value: loading ? '—' : formatCurrency(debtBalance), href: '/dashboard/debts' } : null,
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          {t('dashboard.greeting')}, {user?.name?.split(' ')[0] ?? t('common.member')}!
        </h1>
        <p className="text-muted-foreground mt-1 text-base">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.filter(Boolean).map((stat) => {
          const item = stat!;
          return (
            <Link key={item.label} href={item.href} className="group block">
              <Card className="h-full bg-background shadow-sm border-border/40 transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-md">
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <div className="text-2xl md:text-3xl font-bold text-foreground">{item.value}</div>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

        {/* Minhas Tasks */}
        <Card className="lg:col-span-2 bg-background shadow-sm border-border/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('dashboard.myTasks')}</CardTitle>
              <CardDescription>{t('dashboard.myTasksDesc')}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/tasks">
                {t('common.viewAll')} <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : myTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t('dashboard.noTasks')}</p>
            ) : (
              myTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckSquare className={`h-4 w-4 shrink-0 ${priorityColors[task.priority]}`} />
                    <span className="text-sm font-medium truncate">{task.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge variant="outline" className="text-[10px]">{statusLabels[task.status]}</Badge>
                    {task.deadline && (
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {new Date(task.deadline).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Próximos Eventos */}
        <Card className="bg-background shadow-sm border-border/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('dashboard.upcomingEvents')}</CardTitle>
            </div>
            {canViewEvents && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/events">
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('dashboard.noEvents')}</p>
            ) : (
              events.map((ev) => (
                <div key={ev.id} className="flex gap-3 items-start">
                  <div className="flex flex-col items-center justify-center bg-primary/10 text-primary rounded-lg h-10 w-10 shrink-0">
                    <span className="text-[10px] font-bold uppercase leading-none">
                      {new Date(ev.startDate).toLocaleDateString('pt-PT', { month: 'short' })}
                    </span>
                    <span className="text-base font-bold leading-none">
                      {new Date(ev.startDate).getDate()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{ev.title}</p>
                    {ev.location && (
                      <p className="text-xs text-muted-foreground truncate">{ev.location}</p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {new Date(ev.startDate).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">

        {/* Recrutamento */}
        <Card className="bg-background shadow-sm border-border/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('dashboard.recruitmentPipeline')}</CardTitle>
              <CardDescription>{t('dashboard.recruitmentDesc')}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/recruitment">
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="space-y-2">
                {Object.entries(stageCounts).map(([stage, count]) => (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">{stage}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: candidates.length > 0 ? `${(count / candidates.length) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-foreground w-4 text-right">{count}</span>
                  </div>
                ))}
                {candidates.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">{t('dashboard.noCandidates')}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Anúncios Recentes */}
        <Card className="bg-background shadow-sm border-border/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('dashboard.recentAnnouncements')}</CardTitle>
              <CardDescription>{t('dashboard.announcementsDesc')}</CardDescription>
            </div>
            {canViewAnnouncements && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/announcements">
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t('dashboard.noAnnouncements')}</p>
            ) : (
              announcements.map((a) => (
                <div key={a.id} className="flex items-start gap-2 py-2 border-b border-border/30 last:border-0">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 mt-0.5">
                    <Megaphone className="h-3 w-3" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{a.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {a.createdBy?.name ?? t('common.system')} · {new Date(a.createdAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
