'use client';

import { useState, useEffect } from 'react';
import { History } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, usePagination } from '@/components/ui/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { useAuth } from '@/lib/auth-context';
import { usePermission } from '@/lib/use-permission';
import { useLocale } from '@/lib/locale-context';
import { api } from '@/lib/api';
import { redirect } from 'next/navigation';

interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  performedBy: { id: string; name: string } | null;
  createdAt: string;
}

export default function AuditLogsPage() {
  const { user } = useAuth();
  const { t, formatDate, formatTime } = useLocale();
  const canRead = usePermission('AUDITS_READ');
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { page, pageSize, setPage, setPageSize, paginate } = usePagination(20);

  useEffect(() => {
    if (!user) return;
    if (!canRead) { setLoading(false); return; }
    api.get<AuditLogEntry[]>('/audit-logs')
      .then((data) => { setLogs(data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, canRead]);

  if (!user) return null;
  if (!canRead) { redirect('/dashboard'); return null; }

  const totalPages = Math.ceil(logs.length / pageSize);
  const paginatedLogs = paginate(logs);

  const actionBadgeVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (action.startsWith('CREATE')) return 'default';
    if (action.startsWith('UPDATE')) return 'secondary';
    if (action.startsWith('DELETE')) return 'destructive';
    return 'outline';
  };

  return (
    <Card className="bg-background shadow-sm border-border/40">
      <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            {t('audit.title')}
          </CardTitle>
          <CardDescription className="mt-1">{t('audit.subtitle')}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : paginatedLogs.length === 0 ? (
          <EmptyState icon={History} title={t('audit.empty')} />
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-border/40">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t('audit.user')}</TableHead>
                    <TableHead>{t('audit.action')}</TableHead>
                    <TableHead>{t('audit.entity')}</TableHead>
                    <TableHead className="hidden md:table-cell">ID</TableHead>
                    <TableHead>{t('audit.date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => (
                    <TableRow key={log.id} className="transition-colors hover:bg-muted/50">
                      <TableCell className="align-middle font-medium">
                        {log.performedBy?.name || '—'}
                      </TableCell>
                      <TableCell className="align-middle">
                        <Badge variant={actionBadgeVariant(log.action)} className="border-0 whitespace-nowrap">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-middle text-muted-foreground">{log.entity}</TableCell>
                      <TableCell className="hidden md:table-cell align-middle text-muted-foreground font-mono text-xs">
                        {log.entityId}
                      </TableCell>
                      <TableCell className="align-middle text-muted-foreground whitespace-nowrap text-sm">
                        {formatDate(log.createdAt)} {formatTime(log.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={logs.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
