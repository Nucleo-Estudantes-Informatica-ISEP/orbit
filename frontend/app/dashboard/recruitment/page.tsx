'use client';

import { useState, useEffect, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { Plus, Mail, FileText, Trash2, MessageSquare, History, Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { KanbanColumn } from '@/components/kanban-column';
import { KanbanCard } from '@/components/kanban-card';
import { useAuth } from '@/lib/auth-context';
import { usePermission } from '@/lib/use-permission';
import { useLocale } from '@/lib/locale-context';
import { api, resolveFileUrl } from '@/lib/api';
import { FileUpload } from '@/components/file-upload';
import { toast } from 'sonner';

interface Candidate {
  id: string;
  name: string;
  email: string;
  course?: string;
  year?: number;
  cvUrl?: string;
  notes?: string;
  stage: RecruitmentStage;
  departmentChoices?: { id: string; departmentId: string; priority: number; department: { id: string; name: string } }[];
  createdAt: string;
}

interface Department {
  id: string;
  name: string;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  createdBy?: { id: string; name?: string } | null;
}

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  performedBy?: { name?: string } | null;
}

type RecruitmentStage = 'RECEIVED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED';

const STAGES: { id: RecruitmentStage; label: string; color: string }[] = [
  { id: 'RECEIVED', label: 'recruitment.stage.received', color: 'bg-muted-foreground/40' },
  { id: 'SCREENING', label: 'recruitment.stage.screening', color: 'bg-blue-500' },
  { id: 'INTERVIEW', label: 'recruitment.stage.interview', color: 'bg-primary' },
  { id: 'OFFER', label: 'recruitment.stage.offer', color: 'bg-orange-500' },
  { id: 'HIRED', label: 'recruitment.stage.hired', color: 'bg-green-500' },
  { id: 'REJECTED', label: 'recruitment.stage.rejected', color: 'bg-destructive' },
];

const stageConfig: Record<RecruitmentStage, string> = {
  RECEIVED:  'bg-muted text-muted-foreground border-border/40',
  SCREENING: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  INTERVIEW: 'bg-primary/10 text-primary border-primary/30',
  OFFER:     'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
  HIRED:     'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
  REJECTED:  'bg-destructive/10 text-destructive border-destructive/30',
};

const emptyForm = { name: '', email: '', course: '', year: '', cvUrl: '', notes: '', department1: '', department2: '', department3: '', department4: '' };

export default function RecruitmentPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const canCreate = usePermission('RECRUITMENT_CREATE');
  const canUpdate = usePermission('RECRUITMENT_UPDATE');
  const canDelete = usePermission('RECRUITMENT_DELETE');
  const canRead = usePermission('RECRUITMENT_READ');

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);

  const [clearOpen, setClearOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const load = useCallback(async () => {
    try {
      const [data, depts] = await Promise.all([
        api.get<Candidate[]>('/candidates'),
        api.get<Department[]>('/departments'),
      ]);
      setCandidates(data);
      setDepartments(depts);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Ocorreu um erro'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const openDetail = async (c: Candidate) => {
    setDetailCandidate(c);
    setDetailOpen(true);
    try {
      const [comm, auditData] = await Promise.all([
        api.get<Comment[]>(`/recruitment/comments/candidate/${c.id}`),
        api.get<AuditLog[]>('/audit-logs').catch(() => [] as AuditLog[]),
      ]);
      setComments(comm);
      setLogs((auditData as AuditLog[]).filter((l) => l.entity === 'Candidate' && l.entityId === c.id));
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Ocorreu um erro'); }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCandidate(candidates.find((c) => c.id === event.active.id) ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!canUpdate) {
      setActiveCandidate(null);
      return;
    }

    setActiveCandidate(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const newStage = over.id as RecruitmentStage;
    if (!STAGES.find((s) => s.id === newStage)) return;
    const candidate = candidates.find((c) => c.id === active.id);
    if (!candidate || candidate.stage === newStage) return;
    setCandidates((prev) => prev.map((c) => c.id === candidate.id ? { ...c, stage: newStage } : c));
    try {
      await api.put(`/candidates/${candidate.id}`, { stage: newStage, performedById: user?.id });
    } catch {
      setCandidates((prev) => prev.map((c) => c.id === candidate.id ? { ...c, stage: candidate.stage } : c));
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError(t('recruitment.requiredNameEmail')); return; }
    setSaving(true); setError('');
    try {
      const deptChoices = [form.department1, form.department2, form.department3, form.department4]
        .map((deptId, idx) => deptId ? { departmentId: deptId, priority: idx + 1 } : null)
        .filter(Boolean) as { departmentId: string; priority: number }[];
      const payload = {
        name: form.name,
        email: form.email,
        course: form.course || undefined,
        year: form.year ? Number(form.year) : undefined,
        cvUrl: form.cvUrl || undefined,
        notes: form.notes || undefined,
        departmentChoices: deptChoices.length ? deptChoices : undefined,
        performedById: user?.id,
      };
      const created = await api.post<Candidate>('/candidates', payload);
      setCandidates((prev) => [created, ...prev]);
      setCreateOpen(false);
    } catch (error: unknown) { setError(error instanceof Error ? error.message : t('recruitment.createError')); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/candidates/${id}`);
      setCandidates((prev) => prev.filter((c) => c.id !== id));
      if (detailCandidate?.id === id) setDetailOpen(false);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Ocorreu um erro'); }
  };

  const handleClearAll = async () => {
    try {
      await api.del('/candidates');
      setCandidates([]);
      setClearOpen(false);
      setClearConfirm('');
      toast.success(t('recruitment.pipelineCleared'));
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Ocorreu um erro'); }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !detailCandidate || !user) return;
    setCommentSaving(true);
    try {
      const comment = await api.post<Comment>('/recruitment/comments', { candidateId: detailCandidate.id, createdById: user.id, content: commentText });
      setComments((prev) => [...prev, comment]);
      setCommentText('');
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Ocorreu um erro'); }
    setCommentSaving(false);
  };

  const byStage = (stage: RecruitmentStage) => candidates.filter((c) => c.stage === stage);

  const getDisplayName = (value?: string | null) => value?.trim() || 'Sistema';

  const getInitials = (value?: string | null) => {
    const safeValue = getDisplayName(value);
    return safeValue
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('recruitment.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('recruitment.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate && (
            <Button onClick={() => { setForm(emptyForm); setError(''); setCreateOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />{t('recruitment.newCandidate')}
            </Button>
          )}
          {canRead && (
            <Button variant="outline" onClick={() => api.downloadPdf('/candidates/export/all', 'candidatos.pdf')}>
              <Download className="mr-2 h-4 w-4" />{t('recruitment.exportAll')}
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={() => { setClearConfirm(''); setClearOpen(true); }}>
              <Trash2 className="mr-2 h-4 w-4" />{t('recruitment.clearPipeline')}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <ScrollAreaPrimitive.Root className="relative overflow-hidden w-full h-[calc(100vh-12rem)]">
          <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
            <div className="flex gap-3 pb-4">
              {STAGES.map((s) => <Skeleton key={s.id} className="h-64 w-[260px] shrink-0" />)}
            </div>
          </ScrollAreaPrimitive.Viewport>
          <ScrollAreaPrimitive.Scrollbar orientation="vertical" className="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]">
            <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border" />
          </ScrollAreaPrimitive.Scrollbar>
          <ScrollAreaPrimitive.Scrollbar orientation="horizontal" className="flex touch-none select-none transition-colors h-2.5 flex-col border-t border-t-transparent p-[1px]">
            <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border" />
          </ScrollAreaPrimitive.Scrollbar>
          <ScrollAreaPrimitive.Corner />
        </ScrollAreaPrimitive.Root>
      ) : canUpdate ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <ScrollAreaPrimitive.Root className="relative overflow-hidden w-full h-[calc(100vh-12rem)]">
            <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
              <div className="flex gap-3 pb-4">
                {STAGES.map((stage) => (
                  <KanbanColumn key={stage.id} id={stage.id} title={t(stage.label)} count={byStage(stage.id).length} color={stage.color}>
                  {byStage(stage.id).length === 0 ? (
                    <div className="flex items-center justify-center h-14 text-xs text-muted-foreground">{t('recruitment.noCandidates')}</div>
                  ) : (
                    byStage(stage.id).map((c) => (
                      <KanbanCard key={c.id} id={c.id} onClick={() => openDetail(c)}>
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{c.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                            </div>
                            {canDelete && (
                              <Button variant="ghost" size="icon" className="h-5 w-5 opacity-50 hover:opacity-100 shrink-0" onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex gap-1.5 flex-wrap">
                              {c.course && <Badge variant="outline" className="text-[10px]">{c.course}</Badge>}
                              {c.year && <Badge variant="secondary" className="text-[10px]">{c.year}º ano</Badge>}
                            </div>
                            {c.cvUrl && (
                              <a href={resolveFileUrl(c.cvUrl)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-primary">
                                <FileText className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                          {c.departmentChoices && c.departmentChoices.length > 0 && (
                            <div className="flex gap-1 flex-wrap pt-1">
                              {c.departmentChoices.map((dc) => (
                                <Badge key={dc.id} variant="outline" className="text-[10px] text-primary border-primary/30">
                                  {dc.priority}º {dc.department.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </KanbanCard>
                    ))
                  )}
                </KanbanColumn>
              ))}
            </div>
            </ScrollAreaPrimitive.Viewport>
            <ScrollAreaPrimitive.Scrollbar orientation="vertical" className="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]">
              <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border" />
            </ScrollAreaPrimitive.Scrollbar>
            <ScrollAreaPrimitive.Scrollbar orientation="horizontal" className="flex touch-none select-none transition-colors h-2.5 flex-col border-t border-t-transparent p-[1px]">
              <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border" />
            </ScrollAreaPrimitive.Scrollbar>
            <ScrollAreaPrimitive.Corner />
          </ScrollAreaPrimitive.Root>
          <DragOverlay>
            {activeCandidate && (
              <div className="bg-background border border-primary/40 rounded-lg p-3 shadow-xl w-[272px] opacity-95">
                <p className="text-sm font-semibold">{activeCandidate.name}</p>
                <p className="text-xs text-muted-foreground">{activeCandidate.email}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
          <ScrollAreaPrimitive.Root className="relative overflow-hidden w-full h-[calc(100vh-12rem)]">
            <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
              <div className="flex gap-3 pb-4">
                {STAGES.map((stage) => (
                  <KanbanColumn key={stage.id} id={stage.id} title={t(stage.label)} count={byStage(stage.id).length} color={stage.color}>
                    {byStage(stage.id).length === 0 ? (
                        <div className="flex items-center justify-center h-14 text-xs text-muted-foreground">{t('recruitment.noCandidates')}</div>
                    ) : (
                      byStage(stage.id).map((c) => (
                        <KanbanCard key={c.id} id={c.id} onClick={() => openDetail(c)}>
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">{c.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                              </div>
                              {canDelete && (
                                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-50 hover:opacity-100 shrink-0" onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex gap-1.5 flex-wrap">
                                {c.course && <Badge variant="outline" className="text-[10px]">{c.course}</Badge>}
                                {c.year && <Badge variant="secondary" className="text-[10px]">{c.year}º ano</Badge>}
                              </div>
                              {c.cvUrl && (
                                <a href={resolveFileUrl(c.cvUrl)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-primary">
                                  <FileText className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                            {c.departmentChoices && c.departmentChoices.length > 0 && (
                              <div className="flex gap-1 flex-wrap pt-1">
                                {c.departmentChoices.map((dc) => (
                                  <Badge key={dc.id} variant="outline" className="text-[10px] text-primary border-primary/30">
                                    {dc.priority}º {dc.department.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </KanbanCard>
                      ))
                    )}
                  </KanbanColumn>
                ))}
              </div>
            </ScrollAreaPrimitive.Viewport>
            <ScrollAreaPrimitive.Scrollbar orientation="vertical" className="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]">
              <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border" />
            </ScrollAreaPrimitive.Scrollbar>
            <ScrollAreaPrimitive.Scrollbar orientation="horizontal" className="flex touch-none select-none transition-colors h-2.5 flex-col border-t border-t-transparent p-[1px]">
              <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border" />
            </ScrollAreaPrimitive.Scrollbar>
            <ScrollAreaPrimitive.Corner />
          </ScrollAreaPrimitive.Root>
      )}

      {/* Create Modal */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="w-full max-w-lg sm:max-w-2xl">
          <DialogHeader><DialogTitle>{t('recruitment.newCandidate')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-1 sm:col-span-2">
                <Label>{t('recruitment.nameLabel')}</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder={t('recruitment.namePlaceholder')} />
              </div>
              <div className="space-y-1.5 col-span-1 sm:col-span-2">
                <Label>{t('recruitment.emailLabel')}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder={t('recruitment.emailPlaceholder')} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('recruitment.courseLabel')}</Label>
                <Input value={form.course} onChange={(e) => setForm((p) => ({ ...p, course: e.target.value }))} placeholder={t('recruitment.coursePlaceholder')} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('recruitment.yearLabel')}</Label>
                <Input type="number" min={1} max={6} value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} placeholder={t('recruitment.yearPlaceholder')} />
              </div>
              <div className="space-y-1.5 col-span-1 sm:col-span-2">
                <Label>{t('recruitment.cvLabel')}</Label>
                <FileUpload
                  accept=".pdf,.doc,.docx"
                  maxSizeMB={10}
                  currentKey={form.cvUrl || undefined}
                  currentName={form.cvUrl ? t('recruitment.currentCv') : undefined}
                   onUpload={(result) => setForm((p) => ({ ...p, cvUrl: result.key }))}
                  onClear={() => setForm((p) => ({ ...p, cvUrl: '' }))}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>{t('recruitment.departmentPreferences')}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {([1, 2, 3, 4] as const).map((n) => (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0 w-4">{n}º</span>
                      <Select
                        value={form[`department${n}` as keyof typeof form] as string || '_none'}
                        onValueChange={(v) => setForm((p) => ({ ...p, [`department${n}`]: v === '_none' ? '' : v }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="---" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">---</SelectItem>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 col-span-1 sm:col-span-2">
                <Label>{t('recruitment.notesLabel')}</Label>
                <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder={t('recruitment.notesPlaceholder')} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? t('common.saving') : t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Drawer */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-full max-w-4xl">
          {detailCandidate && (
            <>
              <DialogHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pr-8">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col">
                      <DialogTitle className="text-lg sm:text-xl">{detailCandidate.name}</DialogTitle>
                      <a href={`mailto:${detailCandidate.email}`} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5">
                        <Mail className="h-3.5 w-3.5" />{detailCandidate.email}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${stageConfig[detailCandidate.stage]}`}>
                      {t(STAGES.find((s) => s.id === detailCandidate.stage)?.label ?? '')}
                    </Badge>
                    {canRead && (
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => api.downloadPdf(`/candidates/export/${detailCandidate.id}`, `candidato-${detailCandidate.id}.pdf`)} title={t('recruitment.exportCandidate')}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>
              <div className="flex gap-3 flex-wrap mb-4">
                {detailCandidate.course && <Badge variant="secondary">{detailCandidate.course}</Badge>}
                {detailCandidate.year && <Badge variant="secondary">{detailCandidate.year}º ano</Badge>}
                {detailCandidate.cvUrl && (
                  <a href={resolveFileUrl(detailCandidate.cvUrl)} target="_blank" rel="noopener noreferrer">
                    <Badge variant="outline" className="flex items-center gap-1 text-primary border-primary/30 cursor-pointer hover:bg-primary/5">
                      <FileText className="h-3 w-3" />{t('recruitment.viewCv')}
                    </Badge>
                  </a>
                )}
              </div>
              {detailCandidate.departmentChoices && detailCandidate.departmentChoices.length > 0 && (
                <div className="bg-muted/30 rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{t('recruitment.departmentPreferences')}</p>
                  <div className="flex gap-2 flex-wrap">
                    {detailCandidate.departmentChoices.map((dc) => (
                      <Badge key={dc.id} variant="outline" className="text-primary border-primary/30">
                        {dc.priority}º {dc.department.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {detailCandidate.notes && (
                <div className="bg-muted/30 rounded-lg p-3 mb-4 text-sm text-foreground">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">{t('recruitment.notesLabel')}</p>
                  {detailCandidate.notes}
                </div>
              )}
              <Separator className="my-4" />
              <Tabs defaultValue="comments">
                <TabsList className="w-full h-auto flex flex-col sm:grid sm:grid-cols-2">
                  <TabsTrigger value="comments" className="flex-1 text-left"><MessageSquare className="mr-1.5 h-3.5 w-3.5" />{t('recruitment.comments')} ({comments.length})</TabsTrigger>
                  <TabsTrigger value="history" className="flex-1 text-left"><History className="mr-1.5 h-3.5 w-3.5" />{t('recruitment.history')}</TabsTrigger>
                </TabsList>
                <TabsContent value="comments" className="pt-4 space-y-3">
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t('recruitment.noComments')}</p>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className="flex gap-3 items-start bg-card/50 border border-border rounded-lg p-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-semibold">
                              {getInitials(c.createdBy?.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 justify-between">
                              <div>
                                <span className="text-xs font-semibold">{getDisplayName(c.createdBy?.name)}</span>
                                <div className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString('pt-PT')}</div>
                              </div>
                            </div>
                            <p className="text-sm mt-2">{c.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder={t('recruitment.writeCommentPlaceholder')} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()} />
                    <Button size="sm" onClick={handleAddComment} disabled={commentSaving || !commentText.trim()}>{t('recruitment.send')}</Button>
                  </div>
                </TabsContent>
                <TabsContent value="history" className="pt-4">
                  {logs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t('recruitment.noHistory')}</p>
                  ) : (
                    <div className="space-y-2">
                      {logs.map((l) => (
                        <div key={l.id} className="flex gap-3 items-start text-sm">
                          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          <div>
                              <span className="font-medium">{getDisplayName(l.performedBy?.name)}</span>
                            <span className="text-muted-foreground"> · {l.action.replace(/_/g, ' ').toLowerCase()}</span>
                            <p className="text-[10px] text-muted-foreground">{new Date(l.createdAt).toLocaleDateString('pt-PT')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Clear Pipeline Confirmation */}
      <Dialog open={clearOpen} onOpenChange={(o) => { if (!o) { setClearOpen(false); setClearConfirm(''); } }}>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />{t('recruitment.clearPipelineTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('recruitment.clearPipelineDescription')}</p>
            <p className="text-sm font-medium">{t('recruitment.clearPipelineType')}</p>
            <Input
              value={clearConfirm}
              onChange={(e) => setClearConfirm(e.target.value)}
              placeholder={t('recruitment.clearPipelinePlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setClearOpen(false); setClearConfirm(''); }}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleClearAll} disabled={clearConfirm !== 'ELIMINAR TUDO'}>{t('recruitment.clearPipelineConfirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
