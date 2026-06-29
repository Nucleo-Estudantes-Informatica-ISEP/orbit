'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pin, Globe, Building2, Lock, MoreHorizontal, Trash2, Pencil, X, Megaphone, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import LoadingScreen from '@/components/ui/loading-screen';
import { Pagination, usePagination } from '@/components/ui/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { RichTextEditor } from '@/components/rich-text-editor';
import { useAuth } from '@/lib/auth-context';
import { usePermission } from '@/lib/use-permission';
import { useLocale } from '@/lib/locale-context';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Announcement {
  id: string;
  title: string;
  content: string;
  visibility: 'PUBLIC' | 'DEPARTMENT' | 'PRIVATE';
  pinned: boolean;
  createdAt: string;
  targetUserId?: string;
  createdBy?: { id: string; name: string };
  targetUser?: { id: string; name: string };
  announcementDepartments?: { department: { id: string; name: string } }[];
}

interface Department { id: string; name: string }
interface User { id: string; name: string; email: string }

const visibilityIcon = { PUBLIC: Globe, DEPARTMENT: Building2, PRIVATE: Lock };
const visibilityLabel = { PUBLIC: 'announcements.global', DEPARTMENT: 'announcements.department', PRIVATE: 'announcements.private' };

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const canCreate = usePermission('ANNOUNCEMENTS_CREATE');
  const canDelete = usePermission('ANNOUNCEMENTS_DELETE');
  const canUpdate = usePermission('ANNOUNCEMENTS_UPDATE');

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PUBLIC' | 'DEPARTMENT' | 'PRIVATE'>('ALL');
  const { page, pageSize, setPage, setPageSize, paginate } = usePagination(6);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Announcement | null>(null);
  const [detailTarget, setDetailTarget] = useState<Announcement | null>(null);

  const [form, setForm] = useState({
    title: '',
    content: '',
    visibility: 'PUBLIC' as 'PUBLIC' | 'DEPARTMENT' | 'PRIVATE',
    departmentIds: [] as string[],
    targetUserIds: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [depts, usrs] = await Promise.all([
        api.get<Department[]>('/departments'),
        api.get<User[]>('/users').catch(() => [] as User[]),
      ]);
      setDepartments(depts);
      setUsers(usrs);
      const annRespRaw = await api.get<any>(`/announcements?page=${page}&pageSize=${pageSize}&visibility=${filter}`);
      const annItems: Announcement[] = Array.isArray(annRespRaw) ? annRespRaw : annRespRaw?.items ?? [];
      const annTotal: number = Array.isArray(annRespRaw) ? annItems.length : annRespRaw?.total ?? 0;
      setAnnouncements(annItems);
      setTotal(annTotal);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ocorreu um erro');
    }
    setLoading(false);
  }, [page, pageSize, filter]);

  useEffect(() => { load(); }, [load]);

  const filtered = announcements.filter((a) => filter === 'ALL' || a.visibility === filter);

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) { setError(t('announcements.requiredFields')); return; }
    setSaving(true); setError('');
    try {
      if (editTarget) {
        const updated = await api.put<Announcement>(`/announcements/${editTarget.id}`, { ...form, performedById: user?.id });
        setAnnouncements((prev) => prev.map((a) => a.id === editTarget.id ? updated : a));
      } else {
        const result = await api.post<any>('/announcements', { ...form, createdById: user?.id, performedById: user?.id });
        // PRIVATE announcements are per-user inbox items, not feed posts
        if (form.visibility !== 'PRIVATE') {
          setAnnouncements((prev) => [result, ...prev]);
        }
      }
      setCreateOpen(false);
      setEditTarget(null);
      setForm({ title: '', content: '', visibility: 'PUBLIC', departmentIds: [], targetUserIds: [] });
    } catch (e: any) { setError(e.message || t('common.saveError')); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/announcements/${id}`);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      if (detailTarget?.id === id) setDetailTarget(null);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Ocorreu um erro'); }
  };

  const handleTogglePin = async (id: string) => {
    try {
      const updated = await api.put<Announcement>(`/announcements/${id}/pin`, {});
      setAnnouncements((prev) => prev.map((a) => a.id === id ? { ...a, pinned: updated.pinned } : a));
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Ocorreu um erro'); }
  };

  const openEdit = (a: Announcement) => {
    setForm({
      title: a.title,
      content: a.content,
      visibility: a.visibility,
      departmentIds: a.announcementDepartments?.map((d) => d.department.id) ?? [],
      targetUserIds: a.targetUserId ? [a.targetUserId] : [],
    });
    setEditTarget(a);
  };

  const openDetail = async (a: Announcement) => {
    try {
      const full = await api.get<Announcement>(`/announcements/${a.id}`);
      setDetailTarget(full);
    } catch { setDetailTarget(a); }
  };

  const closeModal = () => { setCreateOpen(false); setEditTarget(null); setError(''); setForm({ title: '', content: '', visibility: 'PUBLIC', departmentIds: [], targetUserIds: [] }); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('announcements.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('announcements.subtitle')}</p>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditTarget(null); setForm({ title: '', content: '', visibility: 'PUBLIC', departmentIds: [], targetUserIds: [] }); setCreateOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> {t('announcements.new')}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['ALL', 'PUBLIC', 'DEPARTMENT', 'PRIVATE'] as const).map((f) => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => { setFilter(f); setPage(1); }}>
            {f === 'ALL' ? t('common.all') : f === 'PUBLIC' ? t('announcements.global') : f === 'DEPARTMENT' ? t('announcements.department') : t('announcements.private')}
          </Button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={t('announcements.emptyTitle')}
          description={t('announcements.emptyDescription')}
          action={canCreate ? <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />{t('announcements.new')}</Button> : undefined}
        />
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => {
            const VIcon = visibilityIcon[a.visibility];
            return (
              <Card
                key={a.id}
                className={`bg-background border-border/40 hover:border-primary/30 transition-colors cursor-pointer ${a.pinned ? 'border-l-2 border-l-primary' : ''}`}
                onClick={() => openDetail(a)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                          {a.createdBy?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'N'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {a.pinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                          <span className="font-semibold text-foreground">{a.title}</span>
                          <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                            <VIcon className="h-3 w-3" /> {t(visibilityLabel[a.visibility])}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.createdBy?.name ?? t('common.system')}
                          {a.visibility === 'PRIVATE' && a.targetUser && <span> → {a.targetUser.name}</span>}
                          {' · '}{new Date(a.createdAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      {(canUpdate || canDelete) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canUpdate && <DropdownMenuItem onClick={() => openEdit(a)}><Pencil className="mr-2 h-4 w-4" />{t('common.edit')}</DropdownMenuItem>}
                            {canUpdate && <DropdownMenuItem onClick={() => handleTogglePin(a.id)}><Pin className="mr-2 h-4 w-4" />{a.pinned ? t('announcements.unpin') : t('announcements.pin')}</DropdownMenuItem>}
                            {canDelete && <DropdownMenuItem onClick={() => handleDelete(a.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />{t('common.delete')}</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground line-clamp-3 prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: a.content }} />
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
      )}

      {/* Create/Edit Modal */}
      <Dialog open={createOpen || !!editTarget} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? t('common.edit') : t('announcements.new')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</div>}
            <div className="space-y-1.5">
              <Label>{t('announcements.titleLabel')}</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder={t('announcements.titlePlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('announcements.visibilityLabel')}</Label>
              <Select value={form.visibility} onValueChange={(v: any) => setForm((p) => ({ ...p, visibility: v, departmentIds: [], targetUserIds: [] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">{t('announcements.global')}</SelectItem>
                  <SelectItem value="DEPARTMENT">{t('announcements.department')}</SelectItem>
                  <SelectItem value="PRIVATE">{t('announcements.private')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.visibility === 'DEPARTMENT' && departments.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t('announcements.departmentsLabel')}</Label>
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
            {form.visibility === 'PRIVATE' && users.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t('announcements.recipientsLabel')}</Label>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto border border-input rounded-lg p-2">
                  {users.map((u) => {
                    const sel = form.targetUserIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setForm((p) => ({
                          ...p,
                          targetUserIds: sel ? p.targetUserIds.filter((id) => id !== u.id) : [...p.targetUserIds, u.id],
                        }))}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors ${sel ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-transparent hover:border-border/40'}`}
                      >
                        {sel && <X className="h-3 w-3" />}{u.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{t('announcements.contentLabel')}</Label>
              <RichTextEditor content={form.content} onChange={(html) => setForm((p) => ({ ...p, content: html }))} placeholder={t('announcements.contentPlaceholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>{t('announcements.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : editTarget ? t('common.save') : t('announcements.publish')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={!!detailTarget} onOpenChange={(o) => !o && setDetailTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailTarget && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap pr-8">
                  {detailTarget.pinned && <Pin className="h-4 w-4 text-primary shrink-0" />}
                  <DialogTitle>{detailTarget.title}</DialogTitle>
                  <Badge variant="outline" className="text-[10px]">{t(visibilityLabel[detailTarget.visibility])}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {detailTarget.createdBy?.name ?? t('common.system')}
                  {detailTarget.visibility === 'PRIVATE' && detailTarget.targetUser && <span> → {detailTarget.targetUser.name}</span>}
                  {' · '}{new Date(detailTarget.createdAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </DialogHeader>
              <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: detailTarget.content }} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
