import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTaskBoardSelection, updateTaskBoardQuery } from '../lib/task-board-selection.ts';

test('task board selection survives URL reloads', () => {
  const query = updateTaskBoardQuery('view=compact', 'board-1', false);
  const searchParams = new URLSearchParams(query);

  assert.equal(getTaskBoardSelection(searchParams), 'board-1');
  assert.equal(searchParams.get('view'), 'compact');
});

test('task board selection switches between boards, projects, and all boards', () => {
  const projectQuery = updateTaskBoardQuery('boardId=board-1', 'project-1', true);
  assert.equal(projectQuery, 'projectId=project-1');

  const allBoardsQuery = updateTaskBoardQuery(projectQuery, 'ALL', false);
  assert.equal(allBoardsQuery, '');
  assert.equal(getTaskBoardSelection(new URLSearchParams(allBoardsQuery)), 'ALL');
});
