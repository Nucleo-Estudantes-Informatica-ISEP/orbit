'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ExternalLink, Pencil, Trash2, BookOpen, Globe, Building2, MoreHorizontal, X, Loader2 } from 'lucide-react';
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
import { SearchInput } from '@/components/search-input';
import { usePermission } from '@/lib/use-permission';
import { useLocale } from '@/lib/locale-context';
import { api, API_BASE, resolveFileUrl } from '@/lib/api';
import { FileUpload } from '@/components/file-upload';
import { toast } from 'sonner';

interface Resource {
  id: string;
  title: string;
  url: string;
  category?: string;
  description?: string;
  visibility: 'PUBLIC' | 'DEPARTMENT' | 'PRIVATE';
  createdAt: string;
  resourceDepartments?: { department: { id: string; name: string } }[];
}

interface Department { id: string; name: string }
type ResourceResponse = Resource[] | { items: Resource[]; total: number };

const categoryColors: Record<string, string> = {
  'Documentos': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  'Tutoriais': 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
  'Templates': 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
  'Links': 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
  'Outros': 'bg-muted text-muted-foreground border-border/40',
};

const visibilityLabel = { PUBLIC: 'common.global', DEPARTMENT: 'common.department', PRIVATE: 'common.private' };
const emptyForm = { title: '', url: '', fileKey: '', fileName: '', category: 'Outros', description: '', visibility: 'PUBLIC' as Resource['visibility'], departmentIds: [] as string[] };

export default function DocumentsPage() {
  const { t } = useLocale();
  const canCreate = usePermission('RESOURCES_CREATE');
  const canUpdate = usePermission('RESOURCES_UPDATE');
  const canDelete = usePermission('RESOURCES_DELETE');

  const [resources, setResources] = useState<Resource[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const { page, pageSize, setPage, setPageSize } = usePagination(6);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Resource | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const depts = await api.get<Department[]>('/departments');
      setDepartments(depts);
      const respRaw = await api.get<ResourceResponse>(
        `/resources?page=${page}&pageSize=${pageSize}&category=${encodeURIComponent(category)}&search=${encodeURIComponent(search)}`,
      );
      const items: Resource[] = Array.isArray(respRaw) ? respRaw : respRaw?.items ?? [];
      const totalNum: number = Array.isArray(respRaw) ? items.length : respRaw?.total ?? 0;
      setResources(items);
      setTotal(totalNum ?? 0);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Ocorreu um erro'); }
    setLoading(false);
  }, [page, pageSize, category, search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const categoryOptions = [
    { value: 'ALL', label: t('common.all') },
    { value: 'Documentos', label: t('documents.categoryDocuments') },
    { value: 'Tutoriais', label: t('documents.categoryTutorials') },
    { value: 'Templates', label: t('documents.categoryTemplates') },
    { value: 'Links', label: t('documents.categoryLinks') },
    { value: 'Outros', label: t('documents.categoryOther') },
  ];

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setError(''); setModalOpen(true); };
  const openEdit = (r: Resource) => {
    setEditTarget(r);
    setForm({
      title: r.title,
      url: r.url,
      fileKey: '',
      fileName: '',
      category: r.category ?? 'Outros',
      description: r.description ?? '',
      visibility: r.visibility,
      departmentIds: r.resourceDepartments?.map((d) => d.department.id) ?? [],
    });
    setError(''); setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Título é obrigatório.'); return; }
    setSaving(true); setError('');
    const payload = {
      title: form.title,
      url: form.url,
      category: form.category,
      description: form.description,
      visibility: form.visibility,
      departmentIds: form.departmentIds,
    };
    try {
      if (editTarget) {
        const updated = await api.put<Resource>(`/resources/${editTarget.id}`, payload);
        setResources((prev) => prev.map((r) => r.id === editTarget.id ? updated : r));
      } else {
    const created = await api.post<Resource>('/resources', payload);
        setResources((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (error: unknown) { setError(error instanceof Error ? error.message : 'Erro ao guardar'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/resources/${id}`);
      setResources((prev) => prev.filter((r) => r.id !== id));
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Ocorreu um erro'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('documents.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('documents.subtitle')}</p>
        </div>
        {canCreate && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t('documents.newResource')}</Button>}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={t('documents.searchPlaceholder')} className="flex-1 min-w-48" />
        <div className="flex gap-2 flex-wrap">
          {categoryOptions.map((c) => (
            <Button key={c.value} variant={category === c.value ? 'default' : 'outline'} size="sm" onClick={() => { setCategory(c.value); setPage(1); }}>{c.label}</Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : resources.length === 0 ? (
        <EmptyState icon={BookOpen} title={t('documents.emptyTitle')} description={t('documents.emptyDescription')} action={canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t('documents.add')}</Button> : undefined} />
      ) : (
        <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map((r) => (
            <Card key={r.id} className="bg-background border-border/40 hover:border-primary/40 transition-colors group">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{r.title}</p>
                      <Badge variant="outline" className={`text-[10px] mt-0.5 ${categoryColors[r.category ?? 'Outros'] ?? categoryColors['Outros']}`}>
                        {r.category ?? 'Outros'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {r.url && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={resolveFileUrl(r.url)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                    {(canUpdate || canDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canUpdate && <DropdownMenuItem onClick={() => openEdit(r)}><Pencil className="mr-2 h-4 w-4" />{t('common.edit')}</DropdownMenuItem>}
                          {canDelete && <DropdownMenuItem onClick={() => handleDelete(r.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />{t('common.delete')}</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                    {r.visibility === 'PUBLIC' ? <Globe className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                    {t(visibilityLabel[r.visibility])}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('pt-PT')}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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

      <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editTarget ? t('common.edit') : t('documents.newResource')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</div>}
            <div className="space-y-1.5">
              <Label>{t('documents.titleLabel')}</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder={t('documents.titlePlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('documents.fileLabel')}</Label>
              <FileUpload
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip"
                maxSizeMB={10}
                currentKey={form.fileKey || undefined}
                currentName={form.fileName || undefined}
                onUpload={(result) => setForm((p) => ({
                  ...p,
                  fileKey: result.key,
                  fileName: result.originalName,
                  url: `${API_BASE}/files/${result.key}`,
                  title: p.title || result.originalName,
                }))}
                onClear={() => setForm((p) => ({ ...p, fileKey: '', fileName: '', url: '' }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('documents.urlLabel')}</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value, fileKey: '', fileName: '' }))}
                placeholder={t('documents.urlPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('documents.categoryLabel')}</Label>
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categoryOptions.filter((c) => c.value !== 'ALL').map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('documents.visibilityLabel')}</Label>
                <Select value={form.visibility} onValueChange={(visibility) => setForm((previous) => ({ ...previous, visibility: visibility as Resource['visibility'], departmentIds: [] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">{t('documents.global')}</SelectItem>
                    <SelectItem value="DEPARTMENT">{t('documents.department')}</SelectItem>
                    <SelectItem value="PRIVATE">{t('documents.private')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.visibility === 'DEPARTMENT' && departments.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t('documents.departmentsLabel')}</Label>
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
              <Label>{t('documents.descriptionLabel')}</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder={t('documents.descriptionPlaceholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t('documents.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : editTarget ? t('common.save') : t('documents.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
