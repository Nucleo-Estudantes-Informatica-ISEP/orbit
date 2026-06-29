'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Package, MoreHorizontal, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Pagination, usePagination } from '@/components/ui/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { FileUpload } from '@/components/file-upload';
import { useAuth } from '@/lib/auth-context';
import { usePermission } from '@/lib/use-permission';
import { useLocale } from '@/lib/locale-context';
import { api, API_BASE } from '@/lib/api';
import { toast } from 'sonner';

interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  value: string;
  purchaseDate?: string;
  warrantyDate?: string;
  photoKey?: string;
  quantity: number;
  purchasedBy?: { id: string; name: string; email: string };
  department?: { id: string; name: string };
  createdAt: string;
}

interface Department { id: string; name: string }
interface User { id: string; name: string; email: string }

const emptyForm = {
  name: '',
  description: '',
  value: '',
  purchaseDate: '',
  warrantyDate: '',
  photoKey: '',
  photoName: '',
  quantity: 1,
  purchasedById: '',
  departmentId: '',
};

function isWarrantyExpired(warrantyDate?: string) {
  if (!warrantyDate) return false;
  return new Date(warrantyDate) < new Date();
}

function isWarrantyExpiringSoon(warrantyDate?: string) {
  if (!warrantyDate) return false;
  const date = new Date(warrantyDate);
  const now = new Date();
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  return date >= now && date <= thirtyDays;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const canCreate = usePermission('INVENTORY_CREATE');
  const canUpdate = usePermission('INVENTORY_UPDATE');
  const canDelete = usePermission('INVENTORY_DELETE');

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const { page, pageSize, setPage, setPageSize, paginate } = usePagination(12);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [inv, depts, usrs] = await Promise.all([
        api.get<InventoryItem[]>('/inventory'),
        api.get<Department[]>('/departments'),
        api.get<User[]>('/users'),
      ]);
      setItems(inv);
      setDepartments(depts);
      setUsers(usrs);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar inventário');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((item) => {
    if (deptFilter !== 'ALL' && item.department?.id !== deptFilter) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) &&
        !(item.description?.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditTarget(item);
    setForm({
      name: item.name,
      description: item.description ?? '',
      value: item.value,
      purchaseDate: item.purchaseDate?.slice(0, 10) ?? '',
      warrantyDate: item.warrantyDate?.slice(0, 10) ?? '',
      photoKey: item.photoKey ?? '',
      photoName: item.photoKey ? 'Foto atual' : '',
      quantity: item.quantity,
      purchasedById: item.purchasedBy?.id ?? '',
      departmentId: item.department?.id ?? '',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório.'); return; }
    if (!form.value || isNaN(parseFloat(form.value))) { setError('Valor deve ser um número válido.'); return; }
    setSaving(true); setError('');
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description || undefined,
        value: form.value,
        purchaseDate: form.purchaseDate || undefined,
        warrantyDate: form.warrantyDate || undefined,
        photoKey: form.photoKey || undefined,
        quantity: form.quantity,
        purchasedById: form.purchasedById || undefined,
        departmentId: form.departmentId || undefined,
        performedById: user?.id,
      };
      if (editTarget) {
        const updated = await api.put<InventoryItem>(`/inventory/${editTarget.id}`, payload);
        setItems((prev) => prev.map((i) => i.id === editTarget.id ? updated : i));
        toast.success('Item atualizado com sucesso');
      } else {
        const created = await api.post<InventoryItem>('/inventory', payload);
        setItems((prev) => [created, ...prev]);
        toast.success('Item criado com sucesso');
      }
      setModalOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/inventory/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success('Item eliminado');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao eliminar');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('inventory.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('inventory.subtitle')}</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />{t('inventory.newItem')}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder={t('inventory.searchPlaceholder')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="sm:max-w-xs"
        />
        <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t('inventory.departmentsAll')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('inventory.departmentsAll')}</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('inventory.emptyTitle')}
          description={t('inventory.emptyDescription')}
          action={canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t('inventory.newItem')}</Button> : undefined}
        />
      ) : (
        <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginate(filtered).map((item) => {
            const expired = isWarrantyExpired(item.warrantyDate);
            const expiringSoon = isWarrantyExpiringSoon(item.warrantyDate);
            return (
              <Card key={item.id} className="bg-background border-border/40 hover:border-primary/40 transition-colors group flex flex-col overflow-hidden">
                {/* Photo */}
                <div className="relative h-40 bg-muted flex items-center justify-center shrink-0">
                  {item.photoKey ? (
                    <img
                      src={`${API_BASE}/files/${item.photoKey}`}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="h-16 w-16 text-muted-foreground/30" />
                  )}
                  {(canUpdate || canDelete) && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canUpdate && (
                            <DropdownMenuItem onClick={() => openEdit(item)}>
                              <Pencil className="mr-2 h-4 w-4" />{t('common.edit')}
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />{t('common.delete')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  {/* Quantity badge */}
                  <div className="absolute bottom-2 left-2">
                    <Badge variant="secondary" className="text-xs font-semibold">
                      {t('inventory.qty')}: {item.quantity}
                    </Badge>
                  </div>
                </div>

                <CardContent className="flex-1 flex flex-col gap-2 p-3">
                  <div>
                    <p className="font-semibold text-sm line-clamp-1">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>
                    )}
                  </div>

                  <div className="mt-auto space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-primary">
                        €{parseFloat(item.value).toFixed(2)}
                      </span>
                      {item.department && (
                        <Badge variant="outline" className="text-[10px]">{item.department.name}</Badge>
                      )}
                    </div>

                    {item.purchaseDate && (
                      <p className="text-xs text-muted-foreground">
                        {t('inventory.purchasedLabel')}: {new Date(item.purchaseDate).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    )}

                    {item.warrantyDate && (
                      <div className={`flex items-center gap-1 text-xs ${expired ? 'text-destructive' : expiringSoon ? 'text-orange-500' : 'text-muted-foreground'}`}>
                        {(expired || expiringSoon) && <AlertTriangle className="h-3 w-3" />}
                        {t('inventory.warrantyLabel')}: {new Date(item.warrantyDate).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {expired && ` (${t('inventory.warrantyExpired')})`}
                        {expiringSoon && ` (${t('inventory.warrantyExpiringSoon')})`}
                      </div>
                    )}

                    {item.purchasedBy && (
                      <p className="text-xs text-muted-foreground truncate">{t('inventory.byLabel')}: {item.purchasedBy.name}</p>
                    )}
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
          pageSizeOptions={[12, 24, 48]}
        />
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <DialogContent className="max-w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? t('common.edit') : t('inventory.newItem')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            )}
            <div className="space-y-1.5">
              <Label>{t('inventory.nameLabel')}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder={t('inventory.namePlaceholder')}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('inventory.descriptionLabel')}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder={t('inventory.descriptionPlaceholder')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('inventory.valueLabel')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.value}
                  onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                  placeholder={t('common.numberPlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('inventory.quantityLabel')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm((p) => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('inventory.purchaseDateLabel')}</Label>
                <Input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => setForm((p) => ({ ...p, purchaseDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('inventory.warrantyDateLabel')}</Label>
                <Input
                  type="date"
                  value={form.warrantyDate}
                  onChange={(e) => setForm((p) => ({ ...p, warrantyDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('inventory.departmentLabel')}</Label>
                <Select
                  value={form.departmentId || 'NONE'}
                  onValueChange={(v) => setForm((p) => ({ ...p, departmentId: v === 'NONE' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder={t('common.none')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{t('common.none')}</SelectItem>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('inventory.buyerLabel')}</Label>
                <Select
                  value={form.purchasedById || 'NONE'}
                  onValueChange={(v) => setForm((p) => ({ ...p, purchasedById: v === 'NONE' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder={t('common.none')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{t('common.none')}</SelectItem>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('inventory.photoLabel')}</Label>
              <FileUpload
                accept="image/*"
                maxSizeMB={5}
                currentKey={form.photoKey || undefined}
                currentName={form.photoName || undefined}
                onUpload={(result) => setForm((p) => ({ ...p, photoKey: result.key, photoName: result.originalName }))}
                onClear={() => setForm((p) => ({ ...p, photoKey: '', photoName: '' }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t('inventory.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'A guardar...' : editTarget ? 'Guardar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
