'use client';

import { useEffect, useState } from 'react';
import { Loader2, Edit2, Trash2, Plus, Users as UsersIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Pagination, usePagination } from '@/components/ui/data-pagination';
import { useAuth } from '@/lib/auth-context';
import { usePermission } from '@/lib/use-permission';
import { useLocale } from '@/lib/locale-context';
import { api } from '@/lib/api';
import { EditUserDialog } from '@/components/edit-user-dialog';
import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog';
import { SearchInput } from '@/components/search-input';

interface PeopleUser {
  id: string;
  name: string;
  email: string;
  department?: { id: string; name: string } | null;
  departmentId?: string;
  roles: string[];
  userRoles?: Array<{ role?: { id: string; name: string } | null }>;
  active: boolean;
  status?: string;
  createdAt?: string;
}

interface RoleOption { id: string; name: string }
interface DepartmentOption { id: string; name: string }

export default function UsersTab() {
  const { t } = useLocale();
  const [users, setUsers] = useState<PeopleUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReferenceLoading, setIsReferenceLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<PeopleUser | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<PeopleUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { token } = useAuth();
  const canCreateUsers = usePermission('USERS_CREATE');
  const canUpdateUsers = usePermission('USERS_UPDATE');
  const canDeleteUsers = usePermission('USERS_DELETE');

  const { page, pageSize, setPage, setPageSize, paginate } = usePagination(10);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await api.get<any[]>('/users');
      const usersList = Array.isArray(data) ? data : [];
      setUsers(
        usersList.map((user: any) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          departmentId: user.departmentId,
          department: user.department,
          roles: user.userRoles?.map((ur: any) => ur.role?.name).filter(Boolean) ?? [],
          userRoles: user.userRoles ?? [],
          active: user.status === 'ACTIVE',
          status: user.status,
          createdAt: user.createdAt,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReferenceData = async () => {
    try {
      setIsReferenceLoading(true);
      const [rolesData, deptsData] = await Promise.all([
        api.get<RoleOption[]>('/roles'),
        api.get<DepartmentOption[]>('/departments'),
      ]);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setDepartments(Array.isArray(deptsData) ? deptsData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reference data');
    } finally {
      setIsReferenceLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      void fetchReferenceData();
      void fetchUsers();
    }
  }, [token]);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const paged = paginate(filtered);

  const handleSaveUser = async (updatedData: Partial<PeopleUser> & { password?: string; roles?: string[] }) => {
    const isEditing = !!selectedUser;
    const payload = {
      name: updatedData.name,
      email: updatedData.email,
      password: updatedData.password,
      departmentId: updatedData.departmentId,
      roles: updatedData.roles,
      status: updatedData.active === false ? 'INACTIVE' : 'ACTIVE',
    };
    if (isEditing) {
      await api.put(`/users/${selectedUser.id}`, payload);
    } else {
      await api.post('/users', payload);
    }
    await fetchUsers();
    setIsDialogOpen(false);
    setSelectedUser(null);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await api.del(`/users/${userToDelete.id}`);
      setUsers((cur) => cur.filter((u) => u.id !== userToDelete.id));
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role.toUpperCase() === 'ADMIN') return <Badge key={role} variant="destructive" className="border-0 bg-destructive/15 text-destructive">{role}</Badge>;
    if (role.toUpperCase() === 'COORDINATOR') return <Badge key={role} variant="default" className="border-0 bg-primary/15 text-primary">{role}</Badge>;
    return <Badge key={role} variant="secondary" className="border-0">{role}</Badge>;
  };

  return (
    <Card className="bg-background shadow-sm border-border/40">
      <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-primary" />
            {t('people.users')}
          </CardTitle>
          <CardDescription className="mt-1">{t('people.subtitle')}</CardDescription>
        </div>
        <div className="flex gap-2">
          <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} className="w-48" />
          {canCreateUsers && (
            <Button
              onClick={() => { setSelectedUser(null); setIsDialogOpen(true); }}
              className="gap-2 shrink-0"
              disabled={isReferenceLoading}
            >
              <Plus className="h-4 w-4" />
              {t('common.create')}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{search ? t('people.noUsersFound') : t('people.noUsers')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-border/40">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent whitespace-nowrap">
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('common.email')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('common.department')}</TableHead>
                    <TableHead>{t('people.role')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    {(canUpdateUsers || canDeleteUsers) && <TableHead className="text-right">{t('common.actions')}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((user) => (
                    <TableRow key={user.id} className="transition-colors hover:bg-muted/50 whitespace-nowrap">
                      <TableCell className="align-middle font-medium">
                        <div className="flex flex-col">
                          <span>{user.name}</span>
                          <span className="mt-1 text-xs text-muted-foreground md:hidden">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell align-middle text-muted-foreground">{user.email}</TableCell>
                      <TableCell className="hidden lg:table-cell align-middle text-muted-foreground">{user.department?.name ?? '—'}</TableCell>
                      <TableCell className="align-middle">
                        <div className="flex gap-1 flex-wrap">{user.roles.map(getRoleBadge)}</div>
                      </TableCell>
                      <TableCell className="align-middle">
                        {user.active
                          ? <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500">{t('common.active')}</Badge>
                          : <Badge variant="outline" className="text-muted-foreground">{t('common.inactive')}</Badge>}
                      </TableCell>
                      {(canUpdateUsers || canDeleteUsers) && (
                        <TableCell className="align-middle text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canUpdateUsers && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                onClick={() => { setSelectedUser(user); setIsDialogOpen(true); }}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                            {canDeleteUsers && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => { setUserToDelete(user); setIsDeleteDialogOpen(true); }}>
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
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 20, 50]}
            />
          </>
        )}
      </CardContent>

      <EditUserDialog
        user={selectedUser}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleSaveUser}
        roles={roles}
        departments={departments}
      />

      {canDeleteUsers && (
        <DeleteConfirmDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          title={t('people.deleteUserTitle')}
          description={t('people.deleteUserDescription')}
          itemName={userToDelete?.name}
          isLoading={isDeleting}
          onConfirm={handleDeleteUser}
        />
      )}
    </Card>
  );
}
