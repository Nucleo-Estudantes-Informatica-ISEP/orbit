'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ClipboardList, CheckCircle2, XCircle, Clock, Calendar, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, usePagination } from '@/components/ui/data-pagination';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/empty-state';
import { FileUpload } from '@/components/file-upload';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { usePermission } from '@/lib/use-permission';
import { api, getFileUrl } from '@/lib/api';
import { toast } from 'sonner';

type PlanStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Plan {
  id: string;
  name: string;
  description?: string;
  status: PlanStatus;
  deadline?: string;
  fileKey?: string;
  department: { id: string; name: string };
  createdBy: { id: string; name: string };
  approvedBy?: { id: string; name: string };
  approvedAt?: string;
  rejectionNote?: string;
  createdAt: string;
}

interface Department { id: string; name: string }

const statusConfig: Record<PlanStatus, { label: string; icon: React.ElementType; className: string }> = {
  PENDING:  { label: 'plans.status.pending',  icon: Clock,          className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30' },
  APPROVED: { label: 'plans.status.approved', icon: CheckCircle2,   className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30' },
  REJECTED: { label: 'plans.status.rejected', icon: XCircle,        className: 'bg-destructive/10 text-destructive border-destructive/30' },
};

const emptyForm = {
  name: '',
  description: '',
  deadline: '',
  fileKey: '',
  fileName: '',
  departmentId: '',
};

const FILTERS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'common.all' },
  { value: 'PENDING', label: 'plans.filter.pending' },
  { value: 'APPROVED', label: 'plans.filter.approved' },
  { value: 'REJECTED', label: 'plans.filter.rejected' },
];

export default function PlansPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const canCreate = usePermission('PLANS_CREATE');
  const canApprove = usePermission('PLANS_APPROVE');
  const canDelete = usePermission('PLANS_DELETE');

  const [plans, setPlans] = useState<Plan[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { page, pageSize, setPage, setPageSize, paginate } = usePagination(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [plns, depts] = await Promise.all([
        api.get<Plan[]>('/plans'),
        api.get<Department[]>('/departments'),
      ]);
      setPlans(plns);
      setDepartments(depts);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar planos');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = plans.filter((p) => statusFilter === 'ALL' || p.status === statusFilter);

  const openCreate = () => {
    setForm({ ...emptyForm });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório.'); return; }
    if (!form.departmentId) { setError('Departamento é obrigatório.'); return; }
    if (!user?.id) { setError('Utilizador não autenticado.'); return; }
    setSaving(true); setError('');
    try {
      const created = await api.post<Plan>('/plans', {
        name: form.name.trim(),
        description: form.description || undefined,
        deadline: form.deadline || undefined,
        fileKey: form.fileKey || undefined,
        departmentId: form.departmentId,
        createdById: user.id,
      });
      setPlans((prev) => [created, ...prev]);
      toast.success('Plano submetido com sucesso');
      setModalOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar');
    }
    setSaving(false);
  };

  const handleApprove = async () => {
    if (!selectedPlan || !user?.id) return;
    setApproving(true);
    try {
      const updated = await api.put<Plan>(`/plans/${selectedPlan.id}/approve`, { approvedById: user.id });
      setPlans((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      setSelectedPlan(updated);
      toast.success('Plano aprovado');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aprovar');
    }
    setApproving(false);
  };

  const handleReject = async () => {
    if (!selectedPlan || !user?.id) return;
    setApproving(true);
    try {
      const updated = await api.put<Plan>(`/plans/${selectedPlan.id}/reject`, {
        approvedById: user.id,
        rejectionNote: rejectionNote || undefined,
      });
      setPlans((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      setSelectedPlan(updated);
      setRejectionNote('');
      toast.success('Plano rejeitado');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao rejeitar');
    }
    setApproving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/plans/${id}`);
      setPlans((prev) => prev.filter((p) => p.id !== id));
      if (selectedPlan?.id === id) setSelectedPlan(null);
      toast.success('Plano eliminado');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao eliminar');
    }
  };

  const isDeadlinePast = (deadline?: string) => deadline && new Date(deadline) < new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('plans.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('plans.subtitle')}</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />{t('plans.submit')}
          </Button>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={statusFilter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
          >
            {t(f.label)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t('plans.emptyTitle')}
          description={statusFilter === 'ALL'
            ? t('plans.emptyAll')
            : `${t('plans.emptyFilteredPrefix')} ${t(statusConfig[statusFilter as PlanStatus]?.label ?? '')}.`}
          action={canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t('plans.submit')}</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {paginate(filtered).map((plan) => {
            const sc = statusConfig[plan.status];
            const StatusIcon = sc.icon;
            const pastDeadline = isDeadlinePast(plan.deadline);
            return (
              <div
                key={plan.id}
                onClick={() => { setSelectedPlan(plan); setRejectionNote(''); }}
                className="flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-background hover:border-primary/40 hover:bg-muted/20 cursor-pointer transition-colors group"
              >
                <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${plan.status === 'PENDING' ? 'text-orange-500' : plan.status === 'APPROVED' ? 'text-green-500' : 'text-destructive'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{plan.name}</p>
                      {plan.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{plan.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${sc.className}`}>{t(sc.label)}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{plan.department.name}</span>
                    <span>{t('plans.by')} {plan.createdBy.name}</span>
                    {plan.deadline && (
                      <span className={`flex items-center gap-1 ${pastDeadline ? 'text-destructive' : ''}`}>
                        <Calendar className="h-3 w-3" />
                        {new Date(plan.deadline).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {pastDeadline && ` (${t('plans.deadlineExpired')})`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedPlan} onOpenChange={(o) => !o && setSelectedPlan(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedPlan && (() => {
            const sc = statusConfig[selectedPlan.status];
            const StatusIcon = sc.icon;
            return (
              <>
                <DialogHeader className="mb-6">
                  <DialogTitle className="flex items-center gap-2">
                    <StatusIcon className={`h-5 w-5 ${selectedPlan.status === 'PENDING' ? 'text-orange-500' : selectedPlan.status === 'APPROVED' ? 'text-green-500' : 'text-destructive'}`} />
                    {selectedPlan.name}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Status badge */}
                  <Badge variant="outline" className={`${sc.className}`}>{t(sc.label)}</Badge>

                  {/* Info grid */}
                  <div className="rounded-lg border border-border/40 divide-y divide-border/40">
                    <div className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{t('plans.department')}</span>
                      <span className="font-medium">{selectedPlan.department.name}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{t('plans.submittedBy')}</span>
                      <span className="font-medium">{selectedPlan.createdBy.name}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{t('plans.submissionDate')}</span>
                      <span>{new Date(selectedPlan.createdAt).toLocaleDateString('pt-PT')}</span>
                    </div>
                    {selectedPlan.deadline && (
                      <div className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-muted-foreground">{t('plans.deadline')}</span>
                        <span className={isDeadlinePast(selectedPlan.deadline) ? 'text-destructive font-medium' : ''}>
                          {new Date(selectedPlan.deadline).toLocaleDateString('pt-PT')}
                        </span>
                      </div>
                    )}
                    {selectedPlan.approvedBy && (
                      <>
                        <div className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="text-muted-foreground">{t('plans.reviewedBy')}</span>
                          <span className="font-medium">{selectedPlan.approvedBy.name}</span>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="text-muted-foreground">{t('plans.reviewDate')}</span>
                          <span>{selectedPlan.approvedAt ? new Date(selectedPlan.approvedAt).toLocaleDateString('pt-PT') : '—'}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Description */}
                  {selectedPlan.description && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('common.description')}</p>
                      <p className="text-sm">{selectedPlan.description}</p>
                    </div>
                  )}

                  {/* Rejection note */}
                  {selectedPlan.status === 'REJECTED' && selectedPlan.rejectionNote && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                      <p className="text-xs font-semibold text-destructive mb-1">{t('plans.rejectionReason')}</p>
                      <p className="text-sm text-destructive/80">{selectedPlan.rejectionNote}</p>
                    </div>
                  )}

                  {/* File download */}
                  {selectedPlan.fileKey && (
                    <a
                      href={getFileUrl(selectedPlan.fileKey)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2.5 text-sm font-medium hover:bg-muted/40 transition-colors"
                    >
                      <Download className="h-4 w-4 text-muted-foreground" />
                      {t('plans.viewAttachment')}
                      <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                    </a>
                  )}

                  {/* Approval panel — only for pending plans + approve permission */}
                  {selectedPlan.status === 'PENDING' && canApprove && (
                    <div className="rounded-lg border border-border/40 p-4 space-y-3">
                      <p className="text-sm font-semibold">{t('plans.approvalDecision')}</p>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t('plans.rejectionReasonLabel')}</Label>
                        <Input
                          placeholder={t('plans.rejectionReasonPlaceholder')}
                          value={rejectionNote}
                          onChange={(e) => setRejectionNote(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={handleApprove}
                          disabled={approving}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />{t('plans.approve')}
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={handleReject}
                          disabled={approving}
                        >
                          <XCircle className="mr-2 h-4 w-4" />{t('plans.reject')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Delete */}
                  {canDelete && (
                    <Button
                      variant="outline"
                      className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => handleDelete(selectedPlan.id)}
                    >
                      {t('plans.delete')}
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Create Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <DialogContent className="max-w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('plans.submit')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{t('plans.nameLabel')}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder={t('plans.namePlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('plans.descriptionLabel')}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder={t('plans.descriptionPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('plans.departmentLabel')}</Label>
                <Select
                  value={form.departmentId || 'NONE'}
                  onValueChange={(v) => setForm((p) => ({ ...p, departmentId: v === 'NONE' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{t('common.select')}</SelectItem>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('plans.deadlineLabel')}</Label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('plans.attachmentLabel')}</Label>
              <FileUpload
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.ppt,.pptx"
                maxSizeMB={10}
                currentKey={form.fileKey || undefined}
                currentName={form.fileName || undefined}
                onUpload={(result) => setForm((p) => ({ ...p, fileKey: result.key, fileName: result.originalName }))}
                onClear={() => setForm((p) => ({ ...p, fileKey: '', fileName: '' }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('plans.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
