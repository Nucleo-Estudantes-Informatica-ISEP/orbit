import { IntakeService } from './intake.service';
import { ProviderHttp, ProviderError } from './provider-http';
import { ServiceUnavailableException } from '@nestjs/common';

describe('independent Forms and Sheets origins', () => {
  const http = { request: jest.fn(), google: jest.fn() };
  const intake = new IntakeService(http as unknown as ProviderHttp);
  const items = [
    ['name', 'Nome e Apelido'],
    ['email', 'E-Mail Pessoal'],
    ['department', 'Departamento'],
    ['cargo', 'Cargo'],
    ['discord', 'ID Discord'],
    ['github', 'Username GitHub'],
    ['google', 'Email Google'],
    ['figma1', 'Email Figma'],
    ['figma2', 'Email Figma'],
  ].map(([questionId, title]) => ({
    title,
    questionItem: { question: { questionId } },
  }));
  const response = (responseId = 'response-one') => ({
    responseId,
    lastSubmittedTime: '2026-10-29T12:00:00Z',
    answers: Object.fromEntries(
      Object.entries({
        name: 'Pessoa',
        email: 'PERSON@example.com',
        department: 'Informática',
        cargo: 'Coordenador',
        discord: 'person.name',
        github: 'person-github',
        google: 'google@example.com',
        figma2: 'figma@example.com',
      }).map(([id, value]) => [id, { textAnswers: { answers: [{ value }] } }]),
    ),
  });
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.ACCESS_FORMS_ID = 'configured-form';
    process.env.ACCESS_SHEETS_ID = 'configured-sheet';
    process.env.ACCESS_SHEETS_RANGE = 'Membros!A1:L5000';
    process.env.ACCESS_SHEETS_DEPARTMENTS = '{"Informática":"department-it"}';
    http.google.mockResolvedValue('Bearer test');
    http.request.mockImplementation((url: string) => {
      if (new URL(url).hostname === 'sheets.googleapis.com')
        return {
          values: [
            ['Nome', 'Email', 'Departamento'],
            ['Pessoa', 'person@example.com', 'Informática'],
          ],
        };
      if (url.includes('/responses?')) return { responses: [response()] };
      return { items };
    });
  });
  afterEach(() => {
    for (const key of [
      'ACCESS_FORMS_ID',
      'ACCESS_FORMS_FIELDS',
      'ACCESS_SHEETS_ID',
      'ACCESS_SHEETS_RANGE',
      'ACCESS_SHEETS_DEPARTMENTS',
    ])
      delete process.env[key];
  });
  it('advertises both origins, prefers Forms and reads its real responses without querying Sheets', async () => {
    expect(intake.sources).toEqual(['FORMS', 'SHEETS']);
    const [row] = await intake.responses();
    expect(row).toMatchObject({
      source: 'FORMS',
      submittedAt: '2026-10-29T12:00:00Z',
      name: 'Pessoa',
      email: 'person@example.com',
      departmentIds: ['department-it'],
      positions: ['COORDINATOR'],
      accounts: {
        discordUsername: 'person.name',
        githubUsername: 'person-github',
        googleEmail: 'google@example.com',
        figmaEmail: 'figma@example.com',
      },
    });
    expect(http.google).toHaveBeenCalledWith('forms');
    expect(
      http.request.mock.calls.every(
        (call: unknown[]) =>
          new URL(String(call[0])).hostname !== 'sheets.googleapis.com',
      ),
    ).toBe(true);
  });
  it('keeps the manual membership sheet independent and available', async () => {
    const [row] = await intake.responses('SHEETS');
    expect(row.source).toBe('SHEETS');
    expect(http.google).toHaveBeenCalledWith('sheets');
    expect(http.request.mock.calls).toHaveLength(1);
  });
  it('works with Forms alone and does not mistake a public URL for response access', async () => {
    delete process.env.ACCESS_SHEETS_ID;
    expect(intake.sources).toEqual(['FORMS']);
    expect(await intake.responses()).toHaveLength(1);
    delete process.env.ACCESS_FORMS_ID;
    expect(intake.sources).toEqual([]);
    await expect(intake.responses()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
  it('reads subsequent response pages and preserves distinct response identities', async () => {
    http.request.mockImplementation((url: string) =>
      url.includes('/responses?')
        ? url.includes('pageToken=next')
          ? {
              responses: [
                {
                  ...response('response-two'),
                  lastSubmittedTime: '2026-10-29T12:00:00.500Z',
                },
              ],
            }
          : { responses: [response()], nextPageToken: 'next' }
        : { items },
    );
    const rows = await intake.responses('FORMS');
    expect(rows).toHaveLength(2);
    expect(rows[0].submittedAt).toBe('2026-10-29T12:00:00.500Z');
    expect(rows[0].key).not.toBe(rows[1].key);
  });
  it('pins a custom field mapping by question ID across duplicate titles', async () => {
    process.env.ACCESS_FORMS_FIELDS = '{"figmaEmail":"figma1"}';
    const [row] = await intake.responses('FORMS');
    expect(row.accounts.figmaEmail).toBe('');
  });
  it('uses a collected respondent email when the Form has no contact-email question', async () => {
    http.request.mockImplementation((url: string) =>
      url.includes('/responses?')
        ? {
            responses: [
              { ...response(), respondentEmail: 'collected@example.com' },
            ],
          }
        : {
            items: items.filter(
              (item) => item.questionItem.question.questionId !== 'email',
            ),
          },
    );
    const [row] = await intake.responses('FORMS');
    expect(row.email).toBe('collected@example.com');
  });
  it('preserves a numeric username pinned by question ID without also treating it as a legacy ID', async () => {
    process.env.ACCESS_FORMS_FIELDS = JSON.stringify({
      discordUsername: 'discord',
    });
    const username = '123456789012345678';
    http.request.mockImplementation((url: string) =>
      url.includes('/responses?')
        ? {
            responses: [
              {
                ...response(),
                answers: {
                  ...response().answers,
                  discord: { textAnswers: { answers: [{ value: username }] } },
                },
              },
            ],
          }
        : { items },
    );
    const [row] = await intake.responses('FORMS');
    expect(row.accounts).toMatchObject({
      discordUsername: username,
      discordId: '',
    });
  });
  it('refuses an edited form response and a key supplied against the wrong origin', async () => {
    const [row] = await intake.responses('FORMS');
    await expect(intake.find(row.key, 'SHEETS')).rejects.toThrow('ausente');
    http.request.mockImplementation((url: string) =>
      url.includes('/responses?')
        ? {
            responses: [
              { ...response(), lastSubmittedTime: '2026-10-29T13:00:00Z' },
            ],
          }
        : { items },
    );
    await expect(intake.find(row.key, 'FORMS')).rejects.toThrow('alterada');
  });
  it('does not silently replace unavailable Forms data with the manual sheet', async () => {
    http.request.mockRejectedValue(new ProviderError('PROVIDER_HTTP_403'));
    await expect(intake.responses('FORMS')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(
      http.request.mock.calls.every(
        (call: unknown[]) =>
          new URL(String(call[0])).hostname !== 'sheets.googleapis.com',
      ),
    ).toBe(true);
  });
  it('continues to resolve old Sheets keys even if the new Forms origin is unavailable', async () => {
    const [row] = await intake.responses('SHEETS');
    http.request.mockImplementation((url: string) => {
      if (new URL(url).hostname === 'forms.googleapis.com')
        throw new ProviderError('PROVIDER_HTTP_403');
      return {
        values: [
          ['Nome', 'Email', 'Departamento'],
          ['Pessoa', 'person@example.com', 'Informática'],
        ],
      };
    });
    expect((await intake.find(row.key)).source).toBe('SHEETS');
  });
  it('fails on repeated pagination tokens instead of scanning without a bound', async () => {
    http.request.mockImplementation((url: string) =>
      url.includes('/responses?')
        ? { responses: [response()], nextPageToken: 'loop' }
        : { items },
    );
    await expect(intake.responses('FORMS')).rejects.toThrow('paginação');
  });
});
