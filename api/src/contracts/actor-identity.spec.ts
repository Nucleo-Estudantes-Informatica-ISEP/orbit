import { AnnouncementsController } from '../announcements/announcements.controller';
import { AuditLogsController } from '../audit-logs/audit-logs.controller';
import { DebtsController } from '../debts/debts.controller';
import { EventsController } from '../events/events.controller';
import { IncidentsController } from '../incidents/incidents.controller';
import { InventoryController } from '../inventory/inventory.controller';
import { PlansController } from '../plans/plans.controller';
import { ProjectsController } from '../projects/projects.controller';
import { RecruitmentCommentController } from '../recruitment/recruitment-comment.controller';
import { TasksController } from '../tasks/tasks.controller';

describe('server-owned actor identity', () => {
  const actorId = '7f258c04-c63e-4a80-a4b8-c2134324bc1f';
  const targetId = '35d72b69-0368-4bdc-929c-b26e040aa2c7';

  it('forwards the JWT actor separately from create and comment bodies', async () => {
    const cases: Array<{
      invoke: (service: Record<string, jest.Mock>) => unknown;
      method: string;
      expected: unknown[];
    }> = [
      {
        invoke: (service) =>
          new TasksController(service as never).create(actorId, {
            title: 'Task',
          } as never),
        method: 'create',
        expected: [{ title: 'Task' }, actorId],
      },
      {
        invoke: (service) =>
          new ProjectsController(service as never).create(actorId, {
            name: 'Project',
          } as never),
        method: 'create',
        expected: [{ name: 'Project' }, actorId],
      },
      {
        invoke: (service) =>
          new EventsController(service as never).create(actorId, {
            title: 'Event',
          } as never),
        method: 'create',
        expected: [{ title: 'Event' }, actorId],
      },
      {
        invoke: (service) =>
          new IncidentsController(service as never).create(actorId, {
            name: 'Incident',
          } as never),
        method: 'create',
        expected: [{ name: 'Incident' }, actorId],
      },
      {
        invoke: (service) =>
          new IncidentsController(service as never).addComment(
            actorId,
            { id: targetId },
            { content: 'Comment' },
          ),
        method: 'addComment',
        expected: [targetId, { content: 'Comment' }, actorId],
      },
      {
        invoke: (service) =>
          new AnnouncementsController(service as never).create(actorId, {
            title: 'Announcement',
          } as never),
        method: 'create',
        expected: [{ title: 'Announcement' }, actorId],
      },
      {
        invoke: (service) =>
          new PlansController(service as never).create(actorId, {
            title: 'Plan',
          } as never),
        method: 'create',
        expected: [{ title: 'Plan' }, actorId],
      },
      {
        invoke: (service) =>
          new InventoryController(service as never).create(actorId, {
            name: 'Laptop',
          } as never),
        method: 'create',
        expected: [{ name: 'Laptop' }, actorId],
      },
    ];

    for (const { invoke, method, expected } of cases) {
      const service = { [method]: jest.fn() };
      await invoke(service);
      expect(service[method]).toHaveBeenCalledWith(...expected);
    }
  });

  it('overwrites actor fields assembled for persistence with the JWT actor', async () => {
    const cases: Array<{
      invoke: (service: { create: jest.Mock }) => unknown;
      body: Record<string, unknown>;
      actorField: string;
    }> = [
      {
        invoke: (service) =>
          new RecruitmentCommentController(service as never).create(actorId, {
            candidateId: targetId,
            content: 'Comment',
          }),
        body: { candidateId: targetId, content: 'Comment' },
        actorField: 'createdById',
      },
      {
        invoke: (service) =>
          new DebtsController(service as never).create(actorId, {
            description: 'Debt',
            value: 10,
            type: 'OUTCOME',
          }),
        body: { description: 'Debt', value: 10, type: 'OUTCOME' },
        actorField: 'createdById',
      },
      {
        invoke: (service) =>
          new AuditLogsController(service as never).create(actorId, {
            action: 'CREATE',
            entity: 'Project',
            entityId: targetId,
          }),
        body: { action: 'CREATE', entity: 'Project', entityId: targetId },
        actorField: 'performedById',
      },
    ];

    for (const { invoke, body, actorField } of cases) {
      const service = { create: jest.fn() };
      await invoke(service);
      expect(service.create).toHaveBeenCalledWith({
        ...body,
        [actorField]: actorId,
      });
    }
  });

  it('uses the JWT actor for actor-aware task and plan transitions', async () => {
    const taskService = { update: jest.fn() };
    await new TasksController(taskService as never).update(
      actorId,
      { id: targetId },
      { title: 'Updated' },
    );
    expect(taskService.update).toHaveBeenCalledWith(
      targetId,
      { title: 'Updated' },
      actorId,
    );

    const planService = { approve: jest.fn(), reject: jest.fn() };
    const controller = new PlansController(planService as never);
    await controller.approve(actorId, { id: targetId });
    await controller.reject(actorId, { id: targetId }, { rejectionNote: 'No' });
    expect(planService.approve).toHaveBeenCalledWith(targetId, actorId);
    expect(planService.reject).toHaveBeenCalledWith(targetId, actorId, 'No');
  });
});
