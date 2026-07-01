'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Users, Calendar, MoreHorizontal, CheckSquare, ArrowRight, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Pagination, usePagination } from '@/components/ui/data-pagination';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/empty-state';
import { AvatarGroup } from '@/components/avatar-group';
import { useAuth } from '@/lib/auth-context';
import { usePermission } from '@/lib/use-permission';
import { useLocale } from '@/lib/locale-context';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  deadline?: string;
  department?: { id: string; name: string };
  projectMembers?: { user: { id: string; name: string } }[];
  tasks?: { id: string; status: string }[];
  createdAt: string;
}

interface Department { id: string; name: string }

const statusConfig: Record<string, { label: string; className: string }> = {
  PLANNING:  { label: 'projects.status.planning', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  ACTIVE:    { label: 'projects.status.active', className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30' },
  ON_HOLD:   { label: 'projects.status.onHold', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30' },
  COMPLETED: { label: 'projects.status.completed', className: 'bg-primary/10 text-primary border-primary/30' },
  CANCELLED: { label: 'projects.status.cancelled', className: 'bg-destructive/10 text-destructive border-destructive/30' },
};

const STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const emptyForm = { name: '', description: '', status: 'PLANNING', deadline: '', departmentId: '' };

export default function ProjectsPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const canCreate = usePermission('PROJECTS_CREATE');
  const canUpdate = usePermission('PROJECTS_UPDATE');
  const canDelete = usePermission('PROJECTS_DELETE');

  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const { page, pageSize, setPage, setPageSize, paginate } = usePagination(9);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, d] = await Promise.all([
        api.get<Project[]>('/projects'),
        api.get<Department[]>('/departments'),
      ]);
      setProjects(p);
      setDepartments(d);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Ocorreu um erro'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = projects.filter((p) => statusFilter === 'ALL' || p.status === statusFilter);

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setError(''); setModalOpen(true); };
  const openEdit = (p: Project) => {
    setEditTarget(p);
    setForm({ name: p.name, description: p.description ?? '', status: p.status, deadline: p.deadline?.slice(0, 10) ?? '', departmentId: p.department?.id ?? '' });
    setError(''); setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.departmentId) { setError(t('projects.requiredFields')); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, deadline: form.deadline || undefined, performedById: user?.id };
      if (editTarget) {
        const updated = await api.put<Project>(`/projects/${editTarget.id}`, payload);
        setProjects((prev) => prev.map((p) => p.id === editTarget.id ? updated : p));
      } else {
        const created = await api.post<Project>('/projects', payload);
        setProjects((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (e: any) { setError(e.message || t('common.saveError')); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Ocorreu um erro'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('projects.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('projects.subtitle')}</p>
        </div>
        {canCreate && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t('projects.new')}</Button>}
      </div>

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={statusFilter === 'ALL' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('ALL')}>{t('projects.all')}</Button>
        {STATUSES.map((s) => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => { setStatusFilter(s); setPage(1); }}>
            {t(statusConfig[s].label)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Briefcase} title={t('projects.emptyTitle')} description={t('projects.emptyDescription')} action={canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t('projects.new')}</Button> : undefined} />
      ) : (
        <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginate(filtered).map((p) => {
            const members = (p.projectMembers ?? []).map((m) => m.user);
            const tasks = p.tasks ?? [];
            const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
            const sc = statusConfig[p.status];
            return (
              <Card key={p.id} className="bg-background border-border/40 hover:border-primary/40 transition-colors group flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={`text-[10px] ${sc.className}`}>{t(sc.label)}</Badge>
                        {p.department && <Badge variant="secondary" className="text-[10px]">{p.department.name}</Badge>}
                      </div>
                      <p className="font-semibold truncate">{p.name}</p>
                    </div>
                    {(canUpdate || canDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canUpdate && <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="mr-2 h-4 w-4" />{t('common.edit')}</DropdownMenuItem>}
                          {canDelete && <DropdownMenuItem onClick={() => handleDelete(p.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />{t('common.delete')}</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between gap-3">
                  {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                  <div className="space-y-2 mt-auto">
                    {tasks.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" />{doneTasks}/{tasks.length} {t('projects.tasks')}</span>
                        </div>
                        <Progress value={tasks.length > 0 ? (doneTasks / tasks.length) * 100 : 0} className="h-1.5" />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {p.deadline && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(p.deadline).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}</span>}
                        {members.length > 0 && <AvatarGroup people={members} max={3} />}
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                        <Link href={`/dashboard/tasks?projectId=${p.id}`}>
                          {t('projects.tasks')} <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[9, 18, 36]}
        />
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editTarget ? t('common.edit') : t('projects.new')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label>{t('projects.nameLabel')}</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder={t('projects.namePlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('projects.statusLabel')}</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{t(statusConfig[s].label)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('projects.departmentLabel')}</Label>
                <Select value={form.departmentId} onValueChange={(v) => setForm((p) => ({ ...p, departmentId: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                  <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('projects.deadlineLabel')}</Label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('projects.descriptionLabel')}</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder={t('projects.descriptionPlaceholder')} />
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

