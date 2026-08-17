'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, usePagination } from '@/components/ui/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { useAuth } from '@/lib/auth-context';
import { usePermission } from '@/lib/use-permission';
import { useLocale } from '@/lib/locale-context';
import { api, getFileUrl } from '@/lib/api';
import { redirect } from 'next/navigation';
import { toast } from 'sonner';

interface MinioFile {
  name: string;
  size: number;
  etag: string;
  lastModified: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesPage() {
  const { user } = useAuth();
  const { t, formatDate, formatTime } = useLocale();
  const canView = usePermission('FILES_VIEW');
  const canDelete = usePermission('FILES_DELETE');
  const [files, setFiles] = useState<MinioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const { page, pageSize, setPage, setPageSize } = usePagination(20);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ items: MinioFile[]; total: number }>(`/files?page=${page}&pageSize=${pageSize}`);
      setFiles(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar ficheiros');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    if (!user || !canView) return;
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [user, canView, load]);

  const handleDelete = async (name: string) => {
    if (!confirm(t('files.deleteConfirm'))) return;
    setDeleting(name);
    try {
      await api.del(`/files/${encodeURIComponent(name)}`);
      toast.success(t('files.deleted'));
      setFiles((prev) => prev.filter((f) => f.name !== name));
      setTotal((prev) => prev - 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao eliminar ficheiro');
    } finally {
      setDeleting(null);
    }
  };

  if (!user) return null;
  if (!canView) { redirect('/dashboard'); return null; }

  return (
    <Card className="bg-background shadow-sm border-border/40">
      <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {t('files.title')}
          </CardTitle>
          <CardDescription className="mt-1">{t('files.subtitle')}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : files.length === 0 ? (
          <EmptyState icon={FileText} title={t('files.empty')} />
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-border/40">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t('files.name')}</TableHead>
                    <TableHead>{t('files.size')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('files.lastModified')}</TableHead>
                    <TableHead className="w-32">{t('files.download')}</TableHead>
                    {canDelete && <TableHead className="w-20">{t('files.delete')}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((f) => (
                    <TableRow key={f.name} className="transition-colors hover:bg-muted/50">
                      <TableCell className="align-middle font-mono text-xs max-w-[300px] truncate">
                        {f.name}
                      </TableCell>
                      <TableCell className="align-middle text-muted-foreground whitespace-nowrap">
                        {formatFileSize(f.size)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell align-middle text-muted-foreground whitespace-nowrap text-sm">
                        {formatDate(f.lastModified)} {formatTime(f.lastModified)}
                      </TableCell>
                      <TableCell className="align-middle">
                        <a
                          href={getFileUrl(f.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      </TableCell>
                      {canDelete && (
                        <TableCell className="align-middle">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(f.name)}
                            disabled={deleting === f.name}
                          >
                            {deleting === f.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
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
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
