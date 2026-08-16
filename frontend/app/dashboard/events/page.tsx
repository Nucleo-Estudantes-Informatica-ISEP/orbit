'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, MapPin, Clock, Calendar, MoreHorizontal, LayoutList, CalendarDays, Globe, Building2, X, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pagination, usePagination } from '@/components/ui/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { useAuth } from '@/lib/auth-context';
import { usePermission } from '@/lib/use-permission';
import { useLocale } from '@/lib/locale-context';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Event {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
  visibility: 'PUBLIC' | 'DEPARTMENT' | 'PRIVATE';
  createdAt: string;
  eventDepartments?: { department: { id: string; name: string } }[];
}

interface Department { id: string; name: string }
type EventResponse = Event[] | { items: Event[]; total: number };

const visibilityLabel = { PUBLIC: 'common.global', DEPARTMENT: 'common.department', PRIVATE: 'common.private' };
const emptyForm = { title: '', description: '', location: '', startDate: '', endDate: '', visibility: 'PUBLIC' as Event['visibility'], departmentIds: [] as string[] };

function isToday(date: Date) {
  const now = new Date();
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function isThisWeek(date: Date) {
  const now = new Date();
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);
  return date >= now && date <= weekEnd;
}

export default function EventsPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const canCreate = usePermission('EVENTS_CREATE');
  const canUpdate = usePermission('EVENTS_UPDATE');
  const canDelete = usePermission('EVENTS_DELETE');

  const [events, setEvents] = useState<Event[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState<'ALL' | 'UPCOMING' | 'PAST'>('UPCOMING');
  const { page, pageSize, setPage, setPageSize } = usePagination(6);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Event | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const depts = await api.get<Department[]>('/departments');
      setDepartments(depts);
      if (view === 'calendar') {
        const respRaw = await api.get<EventResponse>(`/events?page=1&pageSize=1000&filter=${filter}`);
        const items: Event[] = Array.isArray(respRaw) ? respRaw : respRaw?.items ?? [];
        const totalNum: number = Array.isArray(respRaw) ? items.length : respRaw?.total ?? 0;
        setEvents(items);
        setTotal(totalNum ?? 0);
      } else {
        const respRaw = await api.get<EventResponse>(`/events?page=${page}&pageSize=${pageSize}&filter=${filter}`);
        const items: Event[] = Array.isArray(respRaw) ? respRaw : respRaw?.items ?? [];
        const totalNum: number = Array.isArray(respRaw) ? items.length : respRaw?.total ?? 0;
        setEvents(items);
        setTotal(totalNum ?? 0);
      }
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Ocorreu um erro'); }
    setLoading(false);
  }, [page, pageSize, filter, view]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const now = new Date();

  // Calendar: current month
  const [calMonth, setCalMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay();

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setError(''); setModalOpen(true); };
  const toLocalDatetime = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openEdit = (e: Event) => {
    setEditTarget(e);
    setForm({
      title: e.title, description: e.description ?? '', location: e.location ?? '',
      startDate: toLocalDatetime(e.startDate), endDate: toLocalDatetime(e.endDate), visibility: e.visibility,
      departmentIds: e.eventDepartments?.map((d) => d.department.id) ?? [],
    });
    setError(''); setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    const payload = {
      ...form,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : form.startDate,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : form.endDate,
    };
    try {
      if (editTarget) {
        const updated = await api.put<Event>(`/events/${editTarget.id}`, payload);
        setEvents((prev) => prev.map((e) => e.id === editTarget.id ? updated : e));
      } else {
        const created = await api.post<Event>('/events', { ...payload, performedById: user?.id });
        setEvents((prev) => [...prev, created].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
      }
      setModalOpen(false);
    } catch (error: unknown) { setError(error instanceof Error ? error.message : 'Erro ao guardar'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/events/${id}`);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Ocorreu um erro'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('events.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('events.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border/40 overflow-hidden">
            <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" className="rounded-none" onClick={() => setView('list')}><LayoutList className="h-4 w-4" /></Button>
            <Button variant={view === 'calendar' ? 'default' : 'ghost'} size="sm" className="rounded-none" onClick={() => setView('calendar')}><CalendarDays className="h-4 w-4" /></Button>
          </div>
          {canCreate && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t('events.newEvent')}</Button>}
        </div>
      </div>

      {/* Filters (list only) */}
      {view === 'list' && (
        <div className="flex gap-2">
          {(['ALL', 'UPCOMING', 'PAST'] as const).map((f) => (
            <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => { setFilter(f); setPage(1); }}>
              {f === 'ALL' ? t('common.all') : f === 'UPCOMING' ? t('events.upcoming') : t('events.past')}
            </Button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : view === 'list' ? (
        events.length === 0 ? (
          <EmptyState icon={Calendar} title={t('events.emptyTitle')} description={t('events.emptyDescription')} action={canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t('events.newEvent')}</Button> : undefined} />
        ) : (
          <div className="space-y-3">
            {events.map((e) => {
              const start = new Date(e.startDate);
              const today = isToday(start);
              const thisWeek = !today && isThisWeek(start);
              return (
                <Card key={e.id} className="bg-background border-border/40 hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex gap-4 items-start">
                      <div className="flex flex-col items-center justify-center bg-primary/10 text-primary rounded-xl h-12 w-12 shrink-0">
                        <span className="text-[10px] font-bold uppercase leading-none">
                          {start.toLocaleDateString('pt-PT', { month: 'short' })}
                        </span>
                        <span className="text-xl font-bold leading-none">{start.getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{e.title}</span>
                              {today && <Badge className="text-[10px] bg-primary text-primary-foreground">{t('common.today')}</Badge>}
                              {thisWeek && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">{t('common.thisWeek')}</Badge>}
                              <Badge variant="outline" className="text-[10px]">
                                {e.visibility === 'PUBLIC' ? <Globe className="mr-1 h-3 w-3" /> : <Building2 className="mr-1 h-3 w-3" />}
                                {t(visibilityLabel[e.visibility])}
                              </Badge>
                            </div>
                            {e.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{e.description}</p>}
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{start.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} – {new Date(e.endDate).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                              {e.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>}
                            </div>
                          </div>
                          {(canUpdate || canDelete) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canUpdate && <DropdownMenuItem onClick={() => openEdit(e)}><Pencil className="mr-2 h-4 w-4" />{t('common.edit')}</DropdownMenuItem>}
                                {canDelete && <DropdownMenuItem onClick={() => handleDelete(e.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />{t('common.delete')}</DropdownMenuItem>}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[6, 12, 24]}
            />
          </div>
        )
      ) : (
        /* Calendar View */
        <Card className="bg-background border-border/40">
          <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="sm" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}>‹</Button>
              <span className="font-semibold capitalize">{calMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</span>
              <Button variant="ghost" size="sm" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}>›</Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
              {[t('events.sunShort'), t('events.monShort'), t('events.tueShort'), t('events.wedShort'), t('events.thuShort'), t('events.friShort'), t('events.satShort')].map((d) => <div key={d} className="font-semibold py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), day);
                const dayEvents = events.filter((e) => {
                  const s = new Date(e.startDate);
                  return s.getDate() === day && s.getMonth() === calMonth.getMonth() && s.getFullYear() === calMonth.getFullYear();
                });
                const todayDay = isToday(date);
                return (
                  <div key={day} className={`min-h-[52px] rounded-lg p-1 text-xs ${todayDay ? 'bg-primary/10 border border-primary/30' : 'border border-transparent hover:border-border/40'}`}>
                    <span className={`font-medium ${todayDay ? 'text-primary' : 'text-foreground'}`}>{day}</span>
                    {dayEvents.slice(0, 2).map((e) => (
                      <div key={e.id} className="mt-0.5 truncate rounded bg-primary/20 text-primary text-[9px] px-1 py-0.5 leading-tight">{e.title}</div>
                    ))}
                    {dayEvents.length > 2 && <div className="text-[9px] text-muted-foreground">+{dayEvents.length - 2}</div>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editTarget ? t('common.edit') : t('events.newEvent')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</div>}
            <div className="space-y-1.5">
              <Label>{t('events.titleLabel')}</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder={t('events.titlePlaceholder')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('events.startLabel')}</Label>
                <Input type="datetime-local" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('events.endLabel')}</Label>
                <Input type="datetime-local" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('events.locationLabel')}</Label>
              <Input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} placeholder={t('events.locationPlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('events.visibilityLabel')}</Label>
              <Select value={form.visibility} onValueChange={(visibility) => setForm((previous) => ({ ...previous, visibility: visibility as Event['visibility'], departmentIds: [] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">{t('events.global')}</SelectItem>
                  <SelectItem value="DEPARTMENT">{t('events.department')}</SelectItem>
                  <SelectItem value="PRIVATE">{t('events.private')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.visibility === 'DEPARTMENT' && departments.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t('events.departmentsLabel')}</Label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto border border-input rounded-lg p-2">
                  {departments.map((d) => {
                    const sel = form.departmentIds.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setForm((p) => ({
                          ...p,
                          departmentIds: sel ? p.departmentIds.filter((id) => id !== d.id) : [...p.departmentIds, d.id],
                        }))}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors ${sel ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-transparent hover:border-border/40'}`}
                      >
                        {sel && <X className="h-3 w-3" />}{d.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{t('events.descriptionLabel')}</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder={t('events.descriptionPlaceholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : editTarget ? t('common.save') : t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
