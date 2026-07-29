'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Building2, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Pagination, usePagination } from '@/components/ui/data-pagination';
import { usePermission } from '@/lib/use-permission';
import { useLocale } from '@/lib/locale-context';
import { api } from '@/lib/api';
import { EditDepartmentDialog } from '@/components/edit-department-dialog';
import { TransferDialog } from '@/components/transfer-dialog';
import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog';

interface Department {
  id: string;
  name: string;
  description?: string | null;
  userCount?: number;
}

export default function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [userCountForDepartment, setUserCountForDepartment] = useState(0);
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);
  const { token } = useAuth();
  const { t } = useLocale();
  const canCreateDepartments = usePermission('DEPARTMENTS_CREATE');
  const canUpdateDepartments = usePermission('DEPARTMENTS_UPDATE');
  const canDeleteDepartments = usePermission('DEPARTMENTS_DELETE');
  const { page, pageSize, setPage, setPageSize, paginate } = usePagination(10);

  const fetchDepartments = async () => {
    try {
      setIsLoading(true);
      const data = await api.get<Department[]>('/departments');
      const departmentsList = Array.isArray(data) ? data : [];

      const departmentsWithCounts = await Promise.all(
        departmentsList.map(async (dept) => {
          try {
            const countData = await api.get<{ count: number }>(`/departments/${dept.id}/users/count`);
            return { ...dept, userCount: countData.count ?? 0 };
          } catch {
            return { ...dept, userCount: 0 };
          }
        }),
      );

      setDepartments(departmentsWithCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('departments.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) void fetchDepartments();
  }, [token]);

  const handleSaveDepartment = async (updatedData: Partial<Department>) => {
    const isEditing = !!selectedDepartment;
    const payload = { name: updatedData.name, description: updatedData.description };
    if (isEditing) {
      await api.put(`/departments/${selectedDepartment.id}`, payload);
    } else {
      await api.post('/departments', payload);
    }
    await fetchDepartments();
    setIsDepartmentDialogOpen(false);
    setSelectedDepartment(null);
  };

  const initiateDeleteDepartment = async (department: Department) => {
    setDepartmentToDelete(department);
    setError('');
    setIsDeletingLoading(true);
    try {
      const data = await api.get<{ count: number }>(`/departments/${department.id}/users/count`);
      setUserCountForDepartment(data.count ?? 0);
      if (data.count > 0) {
        setIsTransferDialogOpen(true);
      } else {
        setIsDeleteConfirmOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveError'));
    } finally {
      setIsDeletingLoading(false);
    }
  };

  const handleTransferAndDelete = async (destinationDepartmentId: string) => {
    if (!departmentToDelete) return;
    setIsDeletingLoading(true);
    try {
      await api.post(`/departments/${departmentToDelete.id}/transfer-and-delete`, { destinationDepartmentId });
      setDepartments((cur) => cur.filter((d) => d.id !== departmentToDelete.id));
      setIsTransferDialogOpen(false);
      setDepartmentToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.deleteError'));
    } finally {
      setIsDeletingLoading(false);
    }
  };

  const handleDirectDelete = async () => {
    if (!departmentToDelete) return;
    setIsDeletingLoading(true);
    try {
      await api.del(`/departments/${departmentToDelete.id}`);
      setDepartments((cur) => cur.filter((d) => d.id !== departmentToDelete.id));
      setIsDeleteConfirmOpen(false);
      setDepartmentToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.deleteError'));
    } finally {
      setIsDeletingLoading(false);
    }
  };

  return (
    <Card className="bg-background shadow-sm border-border/40">
      <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {t('people.departments')}
          </CardTitle>
          <CardDescription className="mt-1">{t('departments.description')}</CardDescription>
        </div>
        {canCreateDepartments && (
          <Button
            onClick={() => { setSelectedDepartment(null); setIsDepartmentDialogOpen(true); }}
            className="w-full gap-2 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {t('departments.addDepartment')}
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-border/40">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent whitespace-nowrap">
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('common.description')}</TableHead>
                    <TableHead>{t('people.users')}</TableHead>
                    {(canUpdateDepartments || canDeleteDepartments) && (
                      <TableHead className="text-center">{t('common.actions')}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginate(departments).map((dept) => (
                    <TableRow key={dept.id} className="transition-colors hover:bg-muted/50 whitespace-nowrap">
                      <TableCell className="align-middle font-medium">{dept.name}</TableCell>
                      <TableCell className="align-middle text-muted-foreground">
                        {dept.description || '—'}
                      </TableCell>
                      <TableCell className="align-middle">
                        <Badge variant="secondary" className="border-0">{dept.userCount ?? 0}</Badge>
                      </TableCell>
                      {(canUpdateDepartments || canDeleteDepartments) && (
                        <TableCell className="align-middle text-center">
                          <div className="flex items-center justify-center gap-1">
                            {canUpdateDepartments && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                onClick={() => { setSelectedDepartment(dept); setIsDepartmentDialogOpen(true); }}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                            {canDeleteDepartments && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => void initiateDeleteDepartment(dept)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={departments.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 20, 50]}
            />
          </>
        )}
      </CardContent>

      <EditDepartmentDialog
        department={selectedDepartment}
        open={isDepartmentDialogOpen}
        onOpenChange={setIsDepartmentDialogOpen}
        onSave={handleSaveDepartment}
      />

      <TransferDialog
        open={isTransferDialogOpen}
        onOpenChange={setIsTransferDialogOpen}
        title={t('departments.transferUsers')}
        description={t('departments.transferDescription')}
        userCount={userCountForDepartment}
        currentItemName={departmentToDelete?.name ?? ''}
        transferOptions={departments
          .filter((d) => d.id !== departmentToDelete?.id)
          .map((d) => ({ id: d.id, name: d.name }))}
        isLoading={isDeletingLoading}
        onConfirm={handleTransferAndDelete}
      />

      <DeleteConfirmDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title={t('departments.confirmDelete')}
        description={t('departments.confirmDeleteDescription')}
        itemName={departmentToDelete?.name}
        isLoading={isDeletingLoading}
        onConfirm={handleDirectDelete}
      />
    </Card>
  );
}
