'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Pencil, ExternalLink, Upload, X, FileText, TrendingUp, TrendingDown, CreditCard, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, usePagination } from '@/components/ui/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { useAuth } from '@/lib/auth-context';
import { usePermission } from '@/lib/use-permission';
import { useLocale } from '@/lib/locale-context';
import { api, getFileUrl } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Debt {
  id: string;
  description: string;
  value: number;
  type: 'INCOME' | 'OUTCOME';
  status: 'PENDING' | 'COMPLETED';
  occurredAt: string;
  completedAt?: string | null;
  debtorName?: string;
  debtorContact?: string;
  creditorName?: string;
  creditorContact?: string;
  fileKeys: string[];
  receivingAccount?: string;
  depositAccount?: string;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

interface UploadedFile {
  key: string;
  originalName: string;
}

const emptyForm = {
  description: '',
  value: '',
  type: 'INCOME' as 'INCOME' | 'OUTCOME',
  status: 'PENDING' as 'PENDING' | 'COMPLETED',
  occurredAt: new Date().toISOString().slice(0, 10),
  debtorName: '',
  debtorContact: '',
  creditorName: '',
  creditorContact: '',
  receivingAccount: '',
  depositAccount: '',
  fileKeys: [] as string[],
};

export default function DebtsPage() {
  const { user } = useAuth();
  const { t, formatDate } = useLocale();
  const canCreate = usePermission('DEBTS_CREATE');
  const canUpdate = usePermission('DEBTS_UPDATE');
  const canDelete = usePermission('DEBTS_DELETE');

  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'INCOME' | 'OUTCOME'>('ALL');
  const { page, pageSize, setPage, setPageSize, paginate } = usePagination(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Debt | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exportOpen, setExportOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [confirmAction, setConfirmAction] = useState<'complete' | 'revert'>('complete');
  const [exportParams, setExportParams] = useState({
    dateFrom: '',
    dateTo: '',
    type: 'ALL' as 'ALL' | 'INCOME' | 'OUTCOME',
    status: 'ALL' as 'ALL' | 'PENDING' | 'COMPLETED',
    sortBy: 'occurredAt' as 'occurredAt' | 'value' | 'createdAt',
    sortDir: 'desc' as 'asc' | 'desc',
    groupBy: 'none' as 'none' | 'type' | 'status' | 'month',
    includeSummary: true,
    columns: {
      description: true,
      value: true,
      type: true,
      status: true,
      date: true,
      debtor: true,
      creditor: true,
      accounts: true,
      files: true,
      createdBy: true,
      createdAt: true,
    },
  });

  const toDateInputValue = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    try {
      const data = await api.get<Debt[]>('/debts');
      setDebts(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('debts.loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'ALL' ? debts : debts.filter((d) => d.type === filter);

  const totalIncome = debts.filter((d) => d.type === 'INCOME').reduce((s, d) => s + Number(d.value), 0);
  const totalOutcome = debts.filter((d) => d.type === 'OUTCOME').reduce((s, d) => s + Number(d.value), 0);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setUploadedFiles([]);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (d: Debt) => {
    setEditTarget(d);
    setForm({
      description: d.description,
      value: String(d.value),
      type: d.type,
      status: d.status,
      occurredAt: toDateInputValue(d.occurredAt),
      debtorName: d.debtorName ?? '',
      debtorContact: d.debtorContact ?? '',
      creditorName: d.creditorName ?? '',
      creditorContact: d.creditorContact ?? '',
      receivingAccount: d.receivingAccount ?? '',
      depositAccount: d.depositAccount ?? '',
      fileKeys: d.fileKeys ?? [],
    });
    setUploadedFiles((d.fileKeys ?? []).map((k) => ({ key: k, originalName: k.split('/').pop() ?? k })));
    setError('');
    setModalOpen(true);
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
    if (!form.description.trim()) { setError(t('debts.descriptionRequired')); return; }
    if (!form.value || isNaN(Number(form.value)) || Number(form.value) <= 0) { setError(t('debts.valueRequired')); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        description: form.description.trim(),
        value: Number(form.value),
        type: form.type,
        status: form.status,
        occurredAt: form.occurredAt,
        debtorName: form.debtorName.trim() || undefined,
        debtorContact: form.debtorContact.trim() || undefined,
        creditorName: form.creditorName.trim() || undefined,
        creditorContact: form.creditorContact.trim() || undefined,
        receivingAccount: form.receivingAccount.trim().slice(0, 64) || undefined,
        depositAccount: form.depositAccount.trim().slice(0, 64) || undefined,
        fileKeys: form.fileKeys,
        createdById: user?.id,
      };
      if (editTarget) {
        const updated = await api.put<Debt>(`/debts/${editTarget.id}`, payload);
        setDebts((prev) => prev.map((d) => d.id === editTarget.id ? updated : d));
      } else {
        const created = await api.post<Debt>('/debts', payload);
        setDebts((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (e: any) { setError(e.message || t('common.saveError')); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/debts/${id}`);
      setDebts((prev) => prev.filter((d) => d.id !== id));
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : t('common.deleteError')); }
  };

  const handleComplete = async (id: string) => {
    try {
      const updated = await api.post<Debt>(`/debts/${id}/complete`, {});
      setDebts((prev) => prev.map((d) => (d.id === id ? updated : d)));
      toast.success(t('debts.completed'));
      setConfirmOpen(false);
      setConfirmText('');
      setConfirmId(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('debts.completeError'));
    }
  };

  const handleRevert = async (id: string) => {
    try {
      const updated = await api.post<Debt>(`/debts/${id}/revert`, {});
      setDebts((prev) => prev.map((d) => (d.id === id ? updated : d)));
      toast.success(t('debts.reverted'));
      setConfirmOpen(false);
      setConfirmText('');
      setConfirmId(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('debts.revertError'));
    }
  };

  const handleExport = () => {
    let data = [...debts];

    if (exportParams.dateFrom) {
      data = data.filter((d) => new Date(d.occurredAt) >= new Date(exportParams.dateFrom));
    }
    if (exportParams.dateTo) {
      const to = new Date(exportParams.dateTo);
      to.setHours(23, 59, 59, 999);
      data = data.filter((d) => new Date(d.occurredAt) <= to);
    }
    if (exportParams.type !== 'ALL') {
      data = data.filter((d) => d.type === exportParams.type);
    }
    if (exportParams.status !== 'ALL') {
      data = data.filter((d) => d.status === exportParams.status);
    }

    data.sort((a, b) => {
      const dir = exportParams.sortDir === 'asc' ? 1 : -1;
      if (exportParams.sortBy === 'value') return (Number(a.value) - Number(b.value)) * dir;
      return (new Date(a[exportParams.sortBy]).getTime() - new Date(b[exportParams.sortBy]).getTime()) * dir;
    });

    if (data.length === 0) {
      toast.error(t('debts.exportNoData'));
      return;
    }

    if (exportParams.groupBy !== 'none') {
      const groups = new Map<string, Debt[]>();
      for (const d of data) {
        let key = '';
        if (exportParams.groupBy === 'type') key = d.type === 'INCOME' ? t('debts.income') : t('debts.outcome');
        else if (exportParams.groupBy === 'status') key = d.status === 'COMPLETED' ? t('debts.statusCompleted') : t('debts.statusPending');
        else if (exportParams.groupBy === 'month') key = new Date(d.occurredAt).toLocaleString('pt-PT', { year: 'numeric', month: 'long' });
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(d);
      }

      const wsData: any[][] = [];
      const cols = buildColumns();

      wsData.push(cols);
      let grandTotal = 0;
      for (const [groupKey, items] of groups) {
        wsData.push([`${groupKey}`, ...Array(cols.length - 1).fill('')]);
        let groupTotal = 0;
        for (const d of items) {
          const row = buildRow(d);
          wsData.push(row);
          groupTotal += Number(d.value);
        }
        if (exportParams.includeSummary) {
          wsData.push([t('debts.exportGroupTotal'), formatCurrency(groupTotal), ...Array(cols.length - 2).fill('')]);
          grandTotal += groupTotal;
        }
        wsData.push([]);
      }
      if (exportParams.includeSummary) {
        wsData.push([t('debts.exportGrandTotal'), formatCurrency(grandTotal)]);
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      colWidths(ws, cols);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, t('debts.title'));
      XLSX.writeFile(wb, `dividas_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setExportOpen(false);
      return;
    }

    const cols = buildColumns();
    const rows = data.map((d) => buildRow(d));
    const wsData = [cols, ...rows];

    if (exportParams.includeSummary) {
      const total = data.reduce((s, d) => s + Number(d.value), 0);
      wsData.push([]);
      wsData.push([t('debts.exportGrandTotal'), formatCurrency(total)]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    colWidths(ws, cols);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('debts.title'));
    XLSX.writeFile(wb, `dividas_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setExportOpen(false);
  };

  const buildColumns = () => {
    const c = exportParams.columns;
    const cols: string[] = [];
    if (c.description) cols.push(t('debts.exportColDescription'));
    if (c.value) cols.push(t('debts.exportColValue'));
    if (c.type) cols.push(t('debts.exportColType'));
    if (c.status) cols.push(t('debts.exportColStatus'));
    if (c.date) cols.push(t('debts.exportColDate'));
    if (c.debtor) cols.push(t('debts.exportColDebtor'));
    if (c.creditor) cols.push(t('debts.exportColCreditor'));
    if (c.accounts) cols.push(t('debts.exportColAccounts'));
    if (c.files) cols.push(t('debts.exportColFiles'));
    if (c.createdBy) cols.push(t('debts.exportColCreatedBy'));
    if (c.createdAt) cols.push(t('debts.exportColCreatedAt'));
    return cols;
  };

  const buildRow = (d: Debt) => {
    const c = exportParams.columns;
    const row: (string | number)[] = [];
    if (c.description) row.push(d.description);
    if (c.value) row.push(Number(d.value));
    if (c.type) row.push(d.type === 'INCOME' ? t('debts.income') : t('debts.outcome'));
    if (c.status) row.push(d.status === 'COMPLETED' ? t('debts.statusCompleted') : t('debts.statusPending'));
    if (c.date) row.push(new Date(d.occurredAt).toLocaleDateString('pt-PT'));
    if (c.debtor) row.push(d.debtorName || (d.debtorContact ? `(${d.debtorContact})` : '—'));
    if (c.creditor) row.push(d.creditorName || (d.creditorContact ? `(${d.creditorContact})` : '—'));
    if (c.accounts) row.push([d.receivingAccount, d.depositAccount].filter(Boolean).join(' / ') || '—');
    if (c.files) row.push((d.fileKeys ?? []).length > 0 ? d.fileKeys.length.toString() : '—');
    if (c.createdBy) row.push(d.createdBy?.name || '—');
    if (c.createdAt) row.push(new Date(d.createdAt).toLocaleDateString('pt-PT'));
    return row;
  };

  const colWidths = (ws: XLSX.WorkSheet, cols: string[]) => {
    const wscols = cols.map((h) => ({ wch: Math.max(h.length * 2, 12) }));
    ws['!cols'] = wscols;
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('debts.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('debts.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setExportOpen(true)}>
            <FileDown className="mr-2 h-4 w-4" />{t('debts.export')}
          </Button>
          {canCreate && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />{t('debts.newDebt')}
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/40 bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('debts.balance')}</p>
          <p className={cn('text-2xl font-bold', totalIncome - totalOutcome >= 0 ? 'text-green-500' : 'text-destructive')}>
            {formatCurrency(totalIncome - totalOutcome)}
          </p>
        </div>
        <div className="rounded-xl border border-border/40 bg-card p-4 flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-green-500 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('debts.income')}</p>
            <p className="text-xl font-bold text-green-500">{formatCurrency(totalIncome)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/40 bg-card p-4 flex items-center gap-3">
          <TrendingDown className="h-8 w-8 text-destructive shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('debts.outcome')}</p>
            <p className="text-xl font-bold text-destructive">{formatCurrency(totalOutcome)}</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['ALL', 'INCOME', 'OUTCOME'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFilter(f); setPage(1); }}
          >
            {f === 'ALL' ? t('debts.filterAll') : f === 'INCOME' ? t('debts.filterIncome') : t('debts.filterOutcome')}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={t('debts.emptyTitle')}
          description={t('debts.emptyDescription')}
          action={canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t('debts.newDebt')}</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {paginate(filtered).map((d) => (
            <div key={d.id} className="rounded-xl border border-border/40 bg-card p-4 flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex items-center gap-2 shrink-0">
                {d.type === 'INCOME' ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
                <Badge variant={d.type === 'INCOME' ? 'outline' : 'destructive'} className={cn(d.type === 'INCOME' && 'border-green-500 text-green-500')}>
                  {d.type === 'INCOME' ? t('debts.income') : t('debts.outcome')}
                </Badge>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium leading-tight">{d.description}</p>
                  <Badge variant={d.status === 'COMPLETED' ? 'default' : 'secondary'}>{d.status === 'COMPLETED' ? t('debts.statusCompleted') : t('debts.statusPending')}</Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  {d.debtorName && <span>Devedor: <span className="text-foreground">{d.debtorName}{d.debtorContact ? ` (${d.debtorContact})` : ''}</span></span>}
                  {d.creditorName && <span>Credor: <span className="text-foreground">{d.creditorName}{d.creditorContact ? ` (${d.creditorContact})` : ''}</span></span>}
                  {d.receivingAccount && <span>Receber em: <span className="text-foreground">{d.receivingAccount}</span></span>}
                  {d.depositAccount && <span>Depositar em: <span className="text-foreground">{d.depositAccount}</span></span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{t('debts.entryDateLabel')}: <span className="text-foreground">{formatDate(d.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })}</span></span>
                  <span>{t('debts.expenseDateLabel')}: <span className="text-foreground">{formatDate(d.occurredAt, { day: '2-digit', month: 'short', year: 'numeric' })}</span></span>
                  {d.completedAt && <span>{t('debts.completedAtLabel')}: <span className="text-foreground">{formatDate(d.completedAt, { day: '2-digit', month: 'short', year: 'numeric' })}</span></span>}
                </div>
                {(d.fileKeys ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {d.fileKeys.map((key) => (
                      <a
                        key={key}
                        href={getFileUrl(key)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline border border-primary/20 rounded px-1.5 py-0.5"
                      >
                        <FileText className="h-3 w-3" />
                        {key.split('/').pop()?.slice(0, 20) ?? key}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('text-lg font-bold', d.type === 'INCOME' ? 'text-green-500' : 'text-destructive')}>
                  {d.type === 'OUTCOME' ? '−' : '+'}{formatCurrency(Number(d.value))}
                </span>
                {canUpdate && d.status !== 'COMPLETED' && (
                  <Button variant="outline" size="sm" onClick={() => { setConfirmAction('complete'); setConfirmId(d.id); setConfirmText(''); setConfirmOpen(true); }}>
                    {t('debts.complete')}
                  </Button>
                )}
                {canUpdate && d.status === 'COMPLETED' && (
                  <Button variant="outline" size="sm" onClick={() => { setConfirmAction('revert'); setConfirmId(d.id); setConfirmText(''); setConfirmOpen(true); }}>
                    {t('debts.revert')}
                  </Button>
                )}
                {canUpdate && d.status !== 'COMPLETED' && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {canDelete && d.status !== 'COMPLETED' && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(d.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
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

      {/* Debt Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editTarget ? t('common.edit') : t('debts.newDebt')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</div>
            )}

            <div className="space-y-1.5">
              <Label>{t('debts.descriptionLabel')}</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder={t('debts.descriptionPlaceholder')} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('debts.valueLabel')}</Label>
                <Input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} placeholder={t('debts.valuePlaceholder')} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('debts.typeLabel')}</Label>
                <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as 'INCOME' | 'OUTCOME' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCOME">{t('debts.income')}</SelectItem>
                    <SelectItem value="OUTCOME">{t('debts.outcome')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('debts.statusLabel')}</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as 'PENDING' | 'COMPLETED' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">{t('debts.statusPending')}</SelectItem>
                    <SelectItem value="COMPLETED">{t('debts.statusCompleted')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('debts.expenseDateLabel')}</Label>
                <Input type="date" value={form.occurredAt} onChange={(e) => setForm((p) => ({ ...p, occurredAt: e.target.value }))} />
              </div>
            </div>

            {form.type === 'OUTCOME' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('debts.creditorNameLabel')}</Label>
                  <Input value={form.creditorName} onChange={(e) => setForm((p) => ({ ...p, creditorName: e.target.value }))} placeholder={t('debts.creditorNamePlaceholder')} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('debts.creditorContactLabel')}</Label>
                  <Input value={form.creditorContact} onChange={(e) => setForm((p) => ({ ...p, creditorContact: e.target.value }))} placeholder={t('debts.creditorContactPlaceholder')} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('debts.debtorNameLabel')}</Label>
                  <Input value={form.debtorName} onChange={(e) => setForm((p) => ({ ...p, debtorName: e.target.value }))} placeholder={t('debts.debtorNamePlaceholder')} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('debts.debtorContactLabel')}</Label>
                  <Input value={form.debtorContact} onChange={(e) => setForm((p) => ({ ...p, debtorContact: e.target.value }))} placeholder={t('debts.debtorContactPlaceholder')} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('debts.receivingAccountLabel')}</Label>
                <Input maxLength={64} value={form.receivingAccount} onChange={(e) => setForm((p) => ({ ...p, receivingAccount: e.target.value }))} placeholder={t('debts.receivingAccountPlaceholder')} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('debts.depositAccountLabel')}</Label>
                <Input maxLength={64} value={form.depositAccount} onChange={(e) => setForm((p) => ({ ...p, depositAccount: e.target.value }))} placeholder={t('debts.depositAccountPlaceholder')} />
              </div>
            </div>

            {/* Multi-file upload */}
            <div className="space-y-1.5">
              <Label>{t('debts.filesLabel')}</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? t('common.loading') : t('debts.addFiles')}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t('debts.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving ? t('debts.creating') : editTarget ? t('debts.save') : t('debts.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('debts.exportDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('debts.exportDateFrom')}</Label>
                <Input type="date" value={exportParams.dateFrom} onChange={(e) => setExportParams((p) => ({ ...p, dateFrom: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('debts.exportDateTo')}</Label>
                <Input type="date" value={exportParams.dateTo} onChange={(e) => setExportParams((p) => ({ ...p, dateTo: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('debts.exportColType')}</Label>
                <Select value={exportParams.type} onValueChange={(v) => setExportParams((p) => ({ ...p, type: v as 'ALL' | 'INCOME' | 'OUTCOME' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{t('debts.filterAll')}</SelectItem>
                    <SelectItem value="INCOME">{t('debts.income')}</SelectItem>
                    <SelectItem value="OUTCOME">{t('debts.outcome')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('debts.exportColStatus')}</Label>
                <Select value={exportParams.status} onValueChange={(v) => setExportParams((p) => ({ ...p, status: v as 'ALL' | 'PENDING' | 'COMPLETED' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{t('debts.filterAll')}</SelectItem>
                    <SelectItem value="PENDING">{t('debts.statusPending')}</SelectItem>
                    <SelectItem value="COMPLETED">{t('debts.statusCompleted')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('debts.exportSortBy')}</Label>
                <Select value={exportParams.sortBy} onValueChange={(v) => setExportParams((p) => ({ ...p, sortBy: v as 'occurredAt' | 'value' | 'createdAt' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="occurredAt">{t('debts.exportColDate')}</SelectItem>
                    <SelectItem value="value">{t('debts.exportColValue')}</SelectItem>
                    <SelectItem value="createdAt">{t('debts.exportColCreatedAt')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('debts.exportSortDir')}</Label>
                <Select value={exportParams.sortDir} onValueChange={(v) => setExportParams((p) => ({ ...p, sortDir: v as 'asc' | 'desc' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">{t('debts.exportDesc')}</SelectItem>
                    <SelectItem value="asc">{t('debts.exportAsc')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('debts.exportGroupBy')}</Label>
                <Select value={exportParams.groupBy} onValueChange={(v) => setExportParams((p) => ({ ...p, groupBy: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('debts.exportGroupNone')}</SelectItem>
                    <SelectItem value="type">{t('debts.exportGroupType')}</SelectItem>
                    <SelectItem value="status">{t('debts.exportGroupStatus')}</SelectItem>
                    <SelectItem value="month">{t('debts.exportGroupMonth')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('debts.exportColumns')}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-lg border border-border/40 p-3">
                {[
                  { key: 'description', label: t('debts.exportColDescription') },
                  { key: 'value', label: t('debts.exportColValue') },
                  { key: 'type', label: t('debts.exportColType') },
                  { key: 'status', label: t('debts.exportColStatus') },
                  { key: 'date', label: t('debts.exportColDate') },
                  { key: 'debtor', label: t('debts.exportColDebtor') },
                  { key: 'creditor', label: t('debts.exportColCreditor') },
                  { key: 'accounts', label: t('debts.exportColAccounts') },
                  { key: 'files', label: t('debts.exportColFiles') },
                  { key: 'createdBy', label: t('debts.exportColCreatedBy') },
                  { key: 'createdAt', label: t('debts.exportColCreatedAt') },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportParams.columns[key as keyof typeof exportParams.columns]}
                      onChange={(e) => setExportParams((p) => ({ ...p, columns: { ...p.columns, [key]: e.target.checked } }))}
                      className="rounded border-border/40 accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={exportParams.includeSummary}
                onChange={(e) => setExportParams((p) => ({ ...p, includeSummary: e.target.checked }))}
                className="rounded border-border/40 accent-primary"
              />
              {t('debts.exportIncludeSummary')}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>{t('debts.cancel')}</Button>
            <Button onClick={handleExport}>
              <FileDown className="mr-2 h-4 w-4" />{t('debts.exportDownload')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Confirmation Dialog (Complete / Revert) */}
      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!o) { setConfirmOpen(false); setConfirmText(''); setConfirmId(null); } }}>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <TrendingUp className="h-5 w-5" />
              {confirmAction === 'revert' ? t('debts.revertTitle') : t('debts.completeTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {confirmAction === 'revert' ? t('debts.revertDescription') : t('debts.completeDescription')}
            </p>
            <p className="text-sm font-medium">
              {confirmAction === 'revert' ? t('debts.revertType') : t('debts.completeType')}
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmAction === 'revert' ? t('debts.revertPlaceholder') : t('debts.completePlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setConfirmText(''); setConfirmId(null); }}>{t('common.cancel')}</Button>
            <Button
              variant="default"
              onClick={() => {
                if (!confirmId) return;
                if (confirmAction === 'revert') handleRevert(confirmId);
                else handleComplete(confirmId);
              }}
              disabled={confirmText !== (confirmAction === 'revert' ? 'Reverter' : 'CONCLUIR')}
            >
              {confirmAction === 'revert' ? t('debts.revertConfirm') : t('debts.completeConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
