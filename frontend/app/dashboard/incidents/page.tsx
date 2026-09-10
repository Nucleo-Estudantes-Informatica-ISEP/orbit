'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Pencil, ExternalLink, Upload, X, FileText, AlertTriangle, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, usePagination } from '@/components/ui/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { usePermission } from '@/lib/use-permission';
import { useLocale } from '@/lib/locale-context';
import { api, getFileUrl } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Comment {
  id: string;
  content: string;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

interface Incident {
  id: string;
  name: string;
  description: string;
  occurredAt: string;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'ANALYZING' | 'RESOLVING' | 'RESOLVED' | 'CLOSED';
  fileKeys: string[];
  createdBy?: { id: string; name: string } | null;
  comments?: Comment[];
  createdAt: string;
}

interface UploadedFile {
  key: string;
  originalName: string;
}

interface Department {
  id: string;
  name: string;
}

const emptyForm = {
  name: '',
  description: '',
  occurredAt: new Date().toISOString().slice(0, 10),
  departmentId: '',
  priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
  status: 'OPEN' as 'OPEN' | 'ANALYZING' | 'RESOLVING' | 'RESOLVED' | 'CLOSED',
  fileKeys: [] as string[],
};

const priorityConfig = {
  LOW: { label: 'incidents.priorityLow', variant: 'outline' as const, classes: 'text-muted-foreground border-muted-foreground/30' },
  MEDIUM: { label: 'incidents.priorityMedium', variant: 'secondary' as const, classes: '' },
  HIGH: { label: 'incidents.priorityHigh', variant: 'default' as const, classes: 'bg-orange-500 hover:bg-orange-600' },
  URGENT: { label: 'incidents.priorityUrgent', variant: 'destructive' as const, classes: '' },
};

const statusConfig = {
  OPEN: { label: 'incidents.statusOpen', variant: 'outline' as const, classes: 'border-blue-500 text-blue-500' },
  ANALYZING: { label: 'incidents.statusAnalyzing', variant: 'secondary' as const, classes: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
  RESOLVING: { label: 'incidents.statusResolving', variant: 'default' as const, classes: 'bg-amber-500 hover:bg-amber-600' },
  RESOLVED: { label: 'incidents.statusResolved', variant: 'default' as const, classes: 'bg-green-500 hover:bg-green-600' },
  CLOSED: { label: 'incidents.statusClosed', variant: 'outline' as const, classes: 'text-muted-foreground border-muted-foreground/30' },
};

export default function IncidentsPage() {
  const { t, formatDate } = useLocale();
  const canCreate = usePermission('INCIDENTS_CREATE');
  const canUpdate = usePermission('INCIDENTS_UPDATE');
  const canDelete = usePermission('INCIDENTS_DELETE');

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const { page, pageSize, setPage, setPageSize, paginate } = usePagination(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [editTarget, setEditTarget] = useState<Incident | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [data, depts] = await Promise.all([
        api.get<Incident[]>('/incidents'),
        api.get<Department[]>('/departments'),
      ]);
      setIncidents(data);
      setDepartments(depts);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('incidents.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const filtered = incidents.filter((d) => {
    if (filterStatus !== 'ALL' && d.status !== filterStatus) return false;
    if (filterPriority && d.priority !== filterPriority) return false;
    return true;
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setUploadedFiles([]);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (d: Incident) => {
    setEditTarget(d);
    setForm({
      name: d.name,
      description: d.description,
      occurredAt: d.occurredAt ? new Date(d.occurredAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      departmentId: d.departmentId ?? '',
      priority: d.priority,
      status: d.status,
      fileKeys: d.fileKeys ?? [],
    });
    setUploadedFiles((d.fileKeys ?? []).map((k) => ({ key: k, originalName: k.split('/').pop() ?? k })));
    setError('');
    setModalOpen(true);
  };

  const openDetail = (d: Incident) => {
    setSelectedIncident(d);
    setCommentText('');
    setDetailOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = '';
    setUploading(true);
    try {
      const results = await Promise.all(
        files.map((f) => api.upload<{ key: string; originalName: string }>('/files/upload', f)),
      );
      const newFiles = results.map((r) => ({ key: r.key, originalName: r.originalName }));
      setUploadedFiles((prev) => [...prev, ...newFiles]);
      setForm((prev) => ({ ...prev, fileKeys: [...prev.fileKeys, ...newFiles.map((f) => f.key)] }));
      toast.success('Ficheiros carregados com sucesso');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar ficheiro');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (key: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.key !== key));
    setForm((prev) => ({ ...prev, fileKeys: prev.fileKeys.filter((k) => k !== key) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError(t('incidents.nameRequired')); return; }
    if (!form.description.trim()) { setError(t('incidents.descriptionRequired')); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        occurredAt: form.occurredAt,
        departmentId: form.departmentId || null,
        priority: form.priority,
        status: form.status,
        fileKeys: form.fileKeys,
      };
      if (editTarget) {
        const updated = await api.put<Incident>(`/incidents/${editTarget.id}`, payload);
        setIncidents((prev) => prev.map((d) => d.id === editTarget.id ? updated : d));
      } else {
        const created = await api.post<Incident>('/incidents', payload);
        setIncidents((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (error: unknown) { setError(error instanceof Error ? error.message : t('common.saveError')); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/incidents/${id}`);
      setIncidents((prev) => prev.filter((d) => d.id !== id));
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : t('common.deleteError')); }
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || !selectedIncident) return;
    setSendingComment(true);
    try {
      const updated = await api.post<Incident>(`/incidents/${selectedIncident.id}/comments`, {
        content: commentText.trim(),
      });
      setSelectedIncident(updated);
      setIncidents((prev) => prev.map((d) => d.id === updated.id ? updated : d));
      setCommentText('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar comentário');
    } finally {
      setSendingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.del(`/incidents/comments/${commentId}`);
      setSelectedIncident((prev) => prev ? {
        ...prev,
        comments: prev.comments?.filter((c) => c.id !== commentId) ?? [],
      } : null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao eliminar comentário');
    }
  };

  const canEditIncident = (status: string) => canUpdate && status !== 'CLOSED' && status !== 'RESOLVED';

  const statusCardBorder = (s: string) => s === 'OPEN' ? 'border-l-blue-500' : s === 'ANALYZING' ? 'border-l-indigo-500' : s === 'RESOLVING' ? 'border-l-amber-500' : s === 'RESOLVED' ? 'border-l-green-500' : 'border-l-muted-foreground/30';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('incidents.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('incidents.subtitle')}</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />{t('incidents.newIncident')}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {([
          { key: 'ALL', label: t('incidents.filterAll'), value: incidents.length, color: '', bg: 'bg-primary/5 border-primary/20', isPriority: false },
          { key: 'OPEN', label: t('incidents.statusOpen'), value: incidents.filter((d) => d.status === 'OPEN').length, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/25', isPriority: false },
          { key: 'ANALYZING', label: t('incidents.statusAnalyzing'), value: incidents.filter((d) => d.status === 'ANALYZING').length, color: 'text-blue-700 dark:text-blue-300', bg: 'bg-indigo-500/10 border-indigo-500/25', isPriority: false },
          { key: 'RESOLVING', label: t('incidents.statusResolving'), value: incidents.filter((d) => d.status === 'RESOLVING').length, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25', isPriority: false },
          { key: 'URGENT', label: t('incidents.priorityUrgent'), value: incidents.filter((d) => d.priority === 'URGENT').length, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/25', isPriority: true },
        ] as const).map(({ key, label, value, color, bg, isPriority }) => {
          const active = isPriority ? filterPriority === key : filterStatus === key;
          return (
            <button
              key={key}
              onClick={() => { setFilterPriority(isPriority ? key : null); setFilterStatus(isPriority ? 'ALL' : key); setPage(1); }}
              className={cn(
                'rounded-xl border p-3 text-left transition-all hover:shadow-sm',
                active ? 'border-primary bg-accent/30 shadow-sm' : `${bg}`,
              )}
            >
              <p className={cn('text-xl font-bold', color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title={t('incidents.emptyTitle')}
          description={t('incidents.emptyDescription')}
          action={canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t('incidents.newIncident')}</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {paginate(filtered).map((d) => (
            <div
              key={d.id}
              className={cn('rounded-xl border bg-card shadow-sm p-4 space-y-3 cursor-pointer hover:shadow-md transition-shadow border-l-4', statusCardBorder(d.status))}
              onClick={() => openDetail(d)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold leading-tight truncate">{d.name}</p>
                    <Badge className={cn(statusConfig[d.status]?.classes)} variant={statusConfig[d.status]?.variant}>
                      {t(statusConfig[d.status]?.label ?? '')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{d.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <Badge variant={priorityConfig[d.priority]?.variant} className={cn('text-xs', priorityConfig[d.priority]?.classes)}>
                  {t(priorityConfig[d.priority]?.label ?? '')}
                </Badge>
                {d.department && <span>{d.department.name}</span>}
                <span>{formatDate(d.createdAt, { day: '2-digit', month: 'short' })}</span>
                {(d.comments?.length ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {d.comments?.length}
                  </span>
                )}
              </div>
            </div>
          ))}
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader className="min-w-0">
            <DialogTitle>{editTarget ? t('incidents.editIncident') : t('incidents.newIncident')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 min-w-0">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 break-words">{error}</div>
            )}
            <div className="space-y-1.5">
              <Label>{t('incidents.nameLabel')}</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder={t('incidents.namePlaceholder')} className="truncate" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label>{t('incidents.descriptionLabel')}</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder={t('incidents.descriptionPlaceholder')} rows={3} className="whitespace-pre-wrap break-words max-w-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('incidents.priorityLabel')}</Label>
                <Select value={form.priority} onValueChange={(priority) => setForm((previous) => ({ ...previous, priority: priority as Incident['priority'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">{t('incidents.priorityLow')}</SelectItem>
                    <SelectItem value="MEDIUM">{t('incidents.priorityMedium')}</SelectItem>
                    <SelectItem value="HIGH">{t('incidents.priorityHigh')}</SelectItem>
                    <SelectItem value="URGENT">{t('incidents.priorityUrgent')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('incidents.statusLabel')}</Label>
                <Select value={form.status} onValueChange={(status) => setForm((previous) => ({ ...previous, status: status as Incident['status'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">{t('incidents.statusOpen')}</SelectItem>
                    <SelectItem value="ANALYZING">{t('incidents.statusAnalyzing')}</SelectItem>
                    <SelectItem value="RESOLVING">{t('incidents.statusResolving')}</SelectItem>
                    <SelectItem value="RESOLVED">{t('incidents.statusResolved')}</SelectItem>
                    <SelectItem value="CLOSED">{t('incidents.statusClosed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('incidents.departmentLabel')}</Label>
                <Select value={form.departmentId || 'NONE'} onValueChange={(v) => setForm((p) => ({ ...p, departmentId: v === 'NONE' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder={t('incidents.departmentPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{t('incidents.noDepartment')}</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('incidents.occurredAtLabel')}</Label>
                <Input type="date" value={form.occurredAt} onChange={(e) => setForm((p) => ({ ...p, occurredAt: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label>{t('incidents.filesLabel')}</Label>
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
              {uploadedFiles.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {uploadedFiles.map((f) => (
                    <div key={f.key} className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/40 px-3 py-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">{f.originalName}</span>
                      <a href={getFileUrl(f.key)} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeFile(f.key)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button type="button" variant="outline" size="sm" className="w-full" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? t('common.loading') : t('incidents.addFiles')}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving ? t('common.loading') : editTarget ? t('common.save') : t('incidents.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={(o) => !o && setDetailOpen(false)}>
        <DialogContent className="max-w-2xl">
          {selectedIncident && (
            <>
              <DialogHeader className="min-w-0">
                <DialogTitle className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{selectedIncident.name.length > 30 ? selectedIncident.name.slice(0, 30) + '...' : selectedIncident.name}</span>
                  <Badge className={cn(statusConfig[selectedIncident.status]?.classes, 'shrink-0')} variant={statusConfig[selectedIncident.status]?.variant}>
                    {t(statusConfig[selectedIncident.status]?.label ?? '')}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 min-w-0">
                <div className="flex flex-wrap gap-3 text-sm">
                  <Badge variant={priorityConfig[selectedIncident.priority]?.variant} className={cn(priorityConfig[selectedIncident.priority]?.classes)}>
                    {t(priorityConfig[selectedIncident.priority]?.label ?? '')}
                  </Badge>
                  {selectedIncident.department && <span className="text-muted-foreground">{selectedIncident.department.name}</span>}
                  <span className="text-muted-foreground">{formatDate(selectedIncident.occurredAt)}</span>
                </div>

                <div className="rounded-lg border border-border/40 bg-muted/30 p-4 overflow-x-hidden">
                  <Textarea readOnly value={selectedIncident.description} className="border-0 bg-transparent p-0 focus-visible:ring-0 resize-none text-sm min-h-0 h-auto max-w-full block" />
                </div>

                {(selectedIncident.fileKeys ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedIncident.fileKeys.map((key) => (
                      <a key={key} href={getFileUrl(key)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline border border-primary/20 rounded px-2 py-1">
                        <FileText className="h-3 w-3" />
                        {key.split('/').pop()?.slice(0, 25) ?? key}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ))}
                  </div>
                )}

                {/* Comments */}
                <div className="space-y-3 min-w-0">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    {t('incidents.comments')} ({selectedIncident.comments?.length ?? 0})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto overflow-x-hidden">
                    {(selectedIncident.comments ?? []).map((c) => (
                      <div key={c.id} className="rounded-lg border border-border/40 bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs text-muted-foreground mb-1">
                            <span className="font-medium text-foreground">{c.createdBy?.name ?? '—'}</span>
                            {' · '}{formatDate(c.createdAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteComment(c.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <Textarea readOnly value={c.content} className="border-0 bg-transparent p-0 focus-visible:ring-0 resize-none text-sm min-h-0 h-auto max-w-full block" />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={t('incidents.commentPlaceholder')}
                      rows={2}
                      className="flex-1 whitespace-pre-wrap break-words max-w-full"
                    />
                    <Button size="icon" className="h-9 w-9 shrink-0 self-end" onClick={handleSendComment} disabled={sendingComment || !commentText.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-border/40">
                  {canEditIncident(selectedIncident.status) && (
                    <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); openEdit(selectedIncident); }}>
                      <Pencil className="mr-2 h-4 w-4" />{t('common.edit')}
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="destructive" size="sm" onClick={() => { handleDelete(selectedIncident.id); setDetailOpen(false); }}>
                      <Trash2 className="mr-2 h-4 w-4" />{t('common.delete')}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
