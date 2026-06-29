'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Shield, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Pagination, usePagination } from '@/components/ui/data-pagination';
import { usePermission } from '@/lib/use-permission';
import { api } from '@/lib/api';
import { EditRoleDialog } from '@/components/edit-role-dialog';
import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog';
import { TransferDialog } from '@/components/transfer-dialog';
import { formatSystemPermission, type SystemPermission } from '@/lib/system-permissions';
import { useLocale } from '@/lib/locale-context';

interface Role {
  id: string;
  name: string;
  description?: string | null;
  permissions: SystemPermission[];
  userRoles?: Array<{ userId: string }>;
}

export default function RolesTab() {
  const { t } = useLocale();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [userCountForRole, setUserCountForRole] = useState(0);
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);
  const { token } = useAuth(); // kept for useEffect trigger
  const canCreateRoles = usePermission('ROLES_CREATE');
  const canUpdateRoles = usePermission('ROLES_UPDATE');
  const canDeleteRoles = usePermission('ROLES_DELETE');
  const { page, pageSize, setPage, setPageSize, paginate } = usePagination(10);

  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const data = await api.get<Role[]>('/roles');
      setRoles(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('roles.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchRoles();
  }, [token]);

  const handleSaveRole = async (updatedData: Partial<Role>) => {
    const isEditing = !!selectedRole;
    const payload = { name: updatedData.name, description: updatedData.description, permissions: updatedData.permissions };
    if (isEditing) {
      await api.put(`/roles/${selectedRole.id}`, payload);
    } else {
      await api.post('/roles', payload);
    }
    await fetchRoles();
    setIsRoleDialogOpen(false);
    setSelectedRole(null);
  };

  const initiateDeleteRole = async (role: Role) => {
    setRoleToDelete(role);
    setError('');
    setIsDeletingLoading(true);
    try {
      const data = await api.get<{ count: number }>(`/roles/${role.id}/users/count`);
      setUserCountForRole(data.count || 0);
      setIsTransferDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('roles.failedToGetUserCount'));
    } finally {
      setIsDeletingLoading(false);
    }
  };

  const handleTransferAndDelete = async (destinationRoleId: string) => {
    if (!roleToDelete) return;
    setIsDeletingLoading(true);
    try {
      await api.post(`/roles/${roleToDelete.id}/transfer-and-delete`, { destinationRoleId });
      setRoles((current) => current.filter((role) => role.id !== roleToDelete.id));
      setIsTransferDialogOpen(false);
      setRoleToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('roles.deleteError'));
    } finally {
      setIsDeletingLoading(false);
    }
  };

  const deleteRole = async (roleId: string) => {
    const roleToDeleteObj = roles.find((r) => r.id === roleId);
    if (!roleToDeleteObj) return;
    await initiateDeleteRole(roleToDeleteObj);
  };

  return (
    <Card className="bg-background shadow-sm border-border/40">
      <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t('people.roles')}
          </CardTitle>
          <CardDescription className="mt-1">{t('people.rolesDescription')}</CardDescription>
        </div>
        {canCreateRoles && (
          <Button onClick={() => { setSelectedRole(null); setIsRoleDialogOpen(true); }} className="w-full gap-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            {t('people.addRole')}
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
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('common.description')}</TableHead>
                    <TableHead>{t('people.users')}</TableHead>
                    <TableHead>{t('people.permissions')}</TableHead>
                    {(canUpdateRoles || canDeleteRoles) && <TableHead className="text-center">{t('common.actions')}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginate(roles).map((role) => (
                    <TableRow key={role.id} className="transition-colors hover:bg-muted/50">
                      <TableCell className="align-middle font-medium">{role.name}</TableCell>
                      <TableCell className="align-middle text-muted-foreground">{role.description || '—'}</TableCell>
                      <TableCell className="align-middle">
                        <Badge variant="secondary" className="border-0">{role.userRoles?.length ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {role.permissions.length > 0 ? (
                            role.permissions.slice(0, 5).map((permission) => (
                              <Badge key={permission} variant="secondary" className="border-0 whitespace-nowrap text-[10px]">
                                {formatSystemPermission(permission)}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                          {role.permissions.length > 5 && (
                            <Badge variant="secondary" className="border-0 text-[10px]">+{role.permissions.length - 5}</Badge>
                          )}
                        </div>
                      </TableCell>
                      {(canUpdateRoles || canDeleteRoles) && (
                        <TableCell className="align-middle text-center">
                          <div className="flex items-center justify-center gap-1">
                            {canUpdateRoles && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                onClick={() => { setSelectedRole(role); setIsRoleDialogOpen(true); }}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                            {canDeleteRoles && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => void deleteRole(role.id)}>
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
              total={roles.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 20, 50]}
            />
          </>
        )}
      </CardContent>

      <EditRoleDialog
        role={selectedRole}
        open={isRoleDialogOpen}
        onOpenChange={setIsRoleDialogOpen}
        onSave={handleSaveRole}
      />

      <TransferDialog
        open={isTransferDialogOpen}
        onOpenChange={setIsTransferDialogOpen}
          title={t('people.transferUsers')}
          description={t('people.transferUsersDescription')}
        userCount={userCountForRole}
        currentItemName={roleToDelete?.name || ''}
        transferOptions={roles.filter((r) => r.id !== roleToDelete?.id).map((r) => ({ id: r.id, name: r.name }))}
        isLoading={isDeletingLoading}
        onConfirm={handleTransferAndDelete}
      />
    </Card>
  );
}