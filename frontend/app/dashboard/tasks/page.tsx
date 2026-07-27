'use client';

import { Suspense } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { KanbanColumn } from '@/components/kanban-column';
import { KanbanCard } from '@/components/kanban-card';
import { PriorityBadge } from '@/components/priority-badge';
import { AvatarGroup } from '@/components/avatar-group';
import { useAuth } from '@/lib/auth-context';
import { usePermission } from '@/lib/use-permission';
import { useLocale } from '@/lib/locale-context';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
  deadline?: string;
  boardId?: string;
  projectId?: string;
  board?: Board | null;
  project?: { id: string; name: string } | null;
  taskAssignees?: { user: { id: string; name: string } }[];
}

interface Board { id: string; name: string; description?: string }
interface User { id: string; name: string; email: string }

const COLUMNS: { id: Task['status']; label: string; color: string }[] = [
  { id: 'TODO', label: 'tasks.todo', color: 'bg-muted-foreground/40' },
  { id: 'IN_PROGRESS', label: 'tasks.inProgress', color: 'bg-primary' },
  { id: 'BLOCKED', label: 'tasks.blocked', color: 'bg-destructive' },
  { id: 'DONE', label: 'tasks.done', color: 'bg-green-500' },
];

const emptyForm = { title: '', description: '', priority: 'MEDIUM', status: 'TODO', deadline: '', boardId: '', projectId: '', assigneeIds: [] as string[] };

function TasksPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const canCreate = usePermission('TASKS_CREATE');
  const canUpdate = usePermission('TASKS_UPDATE');
  const canDelete = usePermission('TASKS_DELETE');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoard, setSelectedBoard] = useState<string>('ALL');
  const [myTasksOnly, setMyTasksOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Task | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const preselectedProject = searchParams.get('projectId') ?? '';

  const availableBoards = Array.from(
    new Map(
      [
        ...boards,
        // include projects as selectable items (projects can act like boards)
        ...projects.map((pr) => ({ id: pr.id, name: pr.name })),
        ...tasks
          .filter((task) => task.board)
          .map((task) => task.board as Board),
      ].map((board) => [board.id, board]),
    ).values(),
  );

  const isProjectId = (id: string) => projects.some((p) => p.id === id);

  const load = useCallback(async () => {
    const [t, b, u, p] = await Promise.all([
      api.get<Task[]>('/tasks').catch(() => [] as Task[]),
      api.get<Board[]>('/boards').catch(() => [] as Board[]),
      api.get<User[]>('/users').catch(() => [] as User[]),
      api.get<{ id: string; name: string }[]>('/projects').catch(() => [] as { id: string; name: string }[]),
    ]);
    setTasks(t);
    setBoards(b);
    setUsers(u);
    setProjects(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const filtered = tasks.filter((t) => {
    if (selectedBoard !== 'ALL') {
      // if selectedBoard is actually a project id, filter by projectId
      if (isProjectId(selectedBoard)) {
        if (t.projectId !== selectedBoard) return false;
      } else {
        if (t.boardId !== selectedBoard) return false;
      }
    }
    if (preselectedProject && t.projectId !== preselectedProject) return false;
    if (myTasksOnly && !t.taskAssignees?.some((a) => a.user.id === user?.id)) return false;
    return true;
  });

  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = filtered.filter((t) => t.status === col.id);
    return acc;
  }, {} as Record<string, Task[]>);

  const handleDragStart = (event: DragStartEvent) => {
    const t = tasks.find((t) => t.id === event.active.id);
    setActiveTask(t ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const newStatus = over.id as Task['status'];
    if (!COLUMNS.find((c) => c.id === newStatus)) return;
    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.status === newStatus) return;
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      await api.put(`/tasks/${task.id}`, { status: newStatus, performedById: user?.id });
    } catch {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: task.status } : t));
    }
  };

  const openCreate = (defaultStatus?: Task['status']) => {
    setEditTarget(null);
    setForm({
      ...emptyForm,
      status: defaultStatus ?? 'TODO',
      boardId: selectedBoard !== 'ALL' && !isProjectId(selectedBoard) ? selectedBoard : '',
      projectId: preselectedProject || (selectedBoard !== 'ALL' && isProjectId(selectedBoard) ? selectedBoard : ''),
    });
    setError(''); setModalOpen(true);
  };
  const openEdit = (t: Task) => {
    setEditTarget(t);
    setForm({
      title: t.title,
      description: t.description ?? '',
      priority: t.priority,
      status: t.status,
      deadline: t.deadline?.slice(0, 10) ?? '',
      boardId: t.boardId ?? t.board?.id ?? '',
      projectId: t.projectId ?? t.project?.id ?? '',
      assigneeIds: t.taskAssignees?.map((a) => a.user.id) ?? [],
    });
    setError(''); setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError(t('tasks.titleRequired')); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        deadline: form.deadline || undefined,
        boardId: form.boardId || undefined,
        projectId: form.projectId || undefined,
        performedById: user?.id,
      };
      if (editTarget) {
        const updated = await api.put<Task>(`/tasks/${editTarget.id}`, payload);
        setTasks((prev) => prev.map((t) => t.id === editTarget.id ? updated : t));
      } else {
        const created = await api.post<Task>('/tasks', payload);
        setTasks((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (error: unknown) { setError(error instanceof Error ? error.message : t('common.saveError')); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Ocorreu um erro'); }
  };

  const toggleAssignee = (userId: string) => {
    setForm((p) => ({
      ...p,
      assigneeIds: p.assigneeIds.includes(userId) ? p.assigneeIds.filter((id) => id !== userId) : [...p.assigneeIds, userId],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('tasks.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('tasks.subtitle')}</p>
        </div>
        {canCreate && <Button onClick={() => openCreate()}><Plus className="mr-2 h-4 w-4" />{t('tasks.newTask')}</Button>}
      </div>

      {/* Board selector + filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedBoard === 'ALL' && preselectedProject ? preselectedProject : selectedBoard} onValueChange={setSelectedBoard}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('tasks.allBoards')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('tasks.allBoards')}</SelectItem>
            {availableBoards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={myTasksOnly ? 'default' : 'outline'} size="sm" onClick={() => setMyTasksOnly(!myTasksOnly)}>
          {t('tasks.myTasks')}
        </Button>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => <Skeleton key={col.id} className="h-64 w-[280px] shrink-0" />)}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                title={t(col.label)}
                count={tasksByStatus[col.id].length}
                color={col.color}
                maxVisible={7}
                headerAction={canCreate ? (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openCreate(col.id)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                ) : undefined}
              >
                {tasksByStatus[col.id].length === 0 ? (
                  <div className="flex items-center justify-center h-16 text-xs text-muted-foreground">{t('tasks.noTasks')}</div>
                ) : (
                  tasksByStatus[col.id].map((task) => (
                    <KanbanCard key={task.id} id={task.id} onClick={() => openEdit(task)}>
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-medium leading-tight line-clamp-2">{task.title}</p>
                          {(canUpdate || canDelete) && (
                            <div className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
                              {canDelete && (
                                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        {task.description && <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>}
                        <div className="flex items-center justify-between gap-2">
                          <PriorityBadge priority={task.priority} />
                          <div className="flex items-center gap-2">
                            {task.deadline && (
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(task.deadline).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                              </span>
                            )}
                            {(task.taskAssignees?.length ?? 0) > 0 && (
                              <AvatarGroup people={task.taskAssignees!.map((a) => a.user)} max={2} />
                            )}
                          </div>
                        </div>
                      </div>
                    </KanbanCard>
                  ))
                )}
              </KanbanColumn>
            ))}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="bg-background border border-primary/40 rounded-lg p-3 shadow-xl w-[272px] opacity-95">
                <p className="text-sm font-medium">{activeTask.title}</p>
                <PriorityBadge priority={activeTask.priority} className="mt-2" />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Task Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editTarget ? t('common.edit') : t('tasks.newTask')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label>{t('tasks.titleLabel')}</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder={t('tasks.titlePlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('tasks.descriptionLabel')}</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder={t('tasks.descriptionPlaceholder')} rows={3} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('tasks.priorityLabel')}</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">{t('tasks.low')}</SelectItem>
                    <SelectItem value="MEDIUM">{t('tasks.medium')}</SelectItem>
                    <SelectItem value="HIGH">{t('tasks.high')}</SelectItem>
                    <SelectItem value="URGENT">{t('tasks.urgent')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('tasks.statusLabel')}</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map((c) => <SelectItem key={c.id} value={c.id}>{t(c.label)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('tasks.deadlineLabel')}</Label>
                <Input type="date" value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('tasks.boardLabel')}</Label>
                <Select
                  value={form.boardId || form.projectId || 'NONE'}
                  onValueChange={(v) => {
                    if (v === 'NONE') {
                      setForm((p) => ({ ...p, boardId: '', projectId: '' }));
                    } else if (isProjectId(v)) {
                      setForm((p) => ({ ...p, projectId: v, boardId: '' }));
                    } else {
                      setForm((p) => ({ ...p, boardId: v, projectId: '' }));
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder={t('tasks.none')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{t('tasks.none')}</SelectItem>
                    {availableBoards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Assignees */}
            <div className="space-y-1.5">
              <Label>{t('tasks.assigneesLabel')}</Label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto border border-input rounded-lg p-2">
                {users.map((u) => {
                  const selected = form.assigneeIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleAssignee(u.id)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors border ${selected ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-transparent hover:border-border/40'}`}
                    >
                      {selected && <X className="h-3 w-3" />}
                      {u.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t('tasks.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t('tasks.creating') : editTarget ? t('tasks.save') : t('tasks.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TasksPageWrapper() {
  return (
    <Suspense>
      <TasksPage />
    </Suspense>
  );
}
