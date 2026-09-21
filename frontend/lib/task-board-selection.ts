export function getTaskBoardSelection(searchParams: Pick<URLSearchParams, 'get'>) {
  return searchParams.get('boardId') ?? searchParams.get('projectId') ?? 'ALL';
}

export function updateTaskBoardQuery(query: string, selection: string, isProject: boolean) {
  const searchParams = new URLSearchParams(query);
  searchParams.delete('boardId');
  searchParams.delete('projectId');

  if (selection !== 'ALL') {
    searchParams.set(isProject ? 'projectId' : 'boardId', selection);
  }

  return searchParams.toString();
}
