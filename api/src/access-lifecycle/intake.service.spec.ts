import { IntakeService } from './intake.service';
import { ProviderHttp } from './provider-http';

describe('Forms / Sheets intake', () => {
  const http = { request: jest.fn(), google: jest.fn() };
  const intake = new IntakeService(http as unknown as ProviderHttp);
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.ACCESS_SHEETS_ID = 'configured-sheet';
    process.env.ACCESS_SHEETS_RANGE = 'Respostas!A1:Z500';
    process.env.ACCESS_SHEETS_DEPARTMENTS = '{"Informática":"department-it"}';
    http.google.mockResolvedValue('Bearer test');
  });
  afterEach(() => {
    delete process.env.ACCESS_SHEETS_COLUMNS;
    delete process.env.ACCESS_SHEETS_POSITIONS;
    delete process.env.ACCESS_SHEETS_ID;
    delete process.env.ACCESS_SHEETS_RANGE;
    delete process.env.ACCESS_SHEETS_DEPARTMENTS;
  });

  it('accepts the existing Membros columns and translates declared Portuguese positions', async () => {
    process.env.ACCESS_SHEETS_COLUMNS =
      '{"name":"Nome e Apelido","email":"E-Mail Pessoal","phone":"Nº Telemóvel","departments":"Departamento","positions":"Cargo","discordId":"ID Discord"}';
    process.env.ACCESS_SHEETS_POSITIONS = '{"Coordenador":"COORDINATOR"}';
    http.request.mockResolvedValue({
      values: [
        [
          'Nome e Apelido',
          'Nº Telemóvel',
          'E-Mail Pessoal',
          'Data de Nascimento',
          'E-Mail ISEP',
          'E-mail NEI',
          'Ano',
          'Departamento',
          'Cargo',
          'Título',
          'ID Discord',
          'Perfil LinkedIn ',
        ],
        [
          'Pessoa',
          '351900000000',
          'person@example.com',
          '2000-01-01',
          '',
          '',
          '3',
          'Informática',
          'Coordenador',
          '',
          '123',
          '',
        ],
      ],
    });
    const [row] = await intake.responses();
    expect(row.positions).toEqual(['COORDINATOR']);
    expect(row.accounts.phone).toBe('351900000000');
    expect(row.accounts.figmaEmail).toBe('');
    expect(row.accounts.googleEmail).toBe('');
    expect(row).not.toHaveProperty('birthDate');
  });

  it('maps declared accounts without treating them as verified identities', async () => {
    http.request.mockResolvedValue({
      values: [
        ['Nome', 'Email', 'Departamentos', 'Cargos', 'Discord ID'],
        ['Pessoa', 'PESSOA@example.com', 'Informática', 'MEMBER', '123'],
      ],
    });
    const [row] = await intake.responses();
    expect(row.email).toBe('pessoa@example.com');
    expect(row.departmentIds).toEqual(['department-it']);
    expect(row.accounts.discordId).toBe('123');
    expect(row).not.toHaveProperty('verificationNote');
    expect(http.request).toHaveBeenCalledWith(
      'https://sheets.googleapis.com/v4/spreadsheets/configured-sheet/values/Respostas!A1%3AZ500',
      'Bearer test',
    );
  });

  it('rejects changed or duplicate responses rather than selecting the wrong person', async () => {
    const row = ['Pessoa', 'person@example.com', 'Informática'];
    http.request.mockResolvedValue({
      values: [['Nome', 'Email', 'Departamentos'], row],
    });
    const [original] = await intake.responses();
    http.request.mockResolvedValue({
      values: [['Nome', 'Email', 'Departamentos'], row, row],
    });
    await expect(intake.find(original.key)).rejects.toThrow('ambígua');
    http.request.mockResolvedValue({
      values: [
        ['Nome', 'Email', 'Departamentos'],
        ['Outra pessoa', 'person@example.com', 'Informática'],
      ],
    });
    await expect(intake.find(original.key)).rejects.toThrow('alterada');
  });

  it('rejects missing required columns and unbounded configured ranges', async () => {
    http.request.mockResolvedValue({
      values: [
        ['Nome', 'Email'],
        ['Pessoa', 'person@example.com'],
      ],
    });
    await expect(intake.responses()).rejects.toThrow('Colunas obrigatórias');
    process.env.ACCESS_SHEETS_RANGE = 'Respostas!A:Z';
    await expect(intake.responses()).rejects.toThrow('última linha');
  });

  it('normalizes existing headers and labels and reads nonempty conditional duplicate columns', async () => {
    process.env.ACCESS_SHEETS_DEPARTMENTS = '{"Informática":"department-it"}';
    http.request.mockResolvedValue({
      values: [
        [
          ' Nome e Apelido ',
          'E-Mail Pessoal',
          'Departamento',
          'Departamento',
          'Cargo',
          'ID Discord',
          'Username GitHub',
          'Email Google',
          'Email Coda',
        ],
        [
          'Pessoa',
          'person@example.com',
          '',
          'informatica',
          'coordenadora',
          'person.name',
          'person-github',
          'drive@example.com',
          'coda@example.com',
        ],
      ],
    });
    const [row] = await intake.responses();
    expect(row.departmentIds).toEqual(['department-it']);
    expect(row.positions).toEqual(['COORDINATOR']);
    expect(row.accounts).toMatchObject({
      discordUsername: 'person.name',
      githubUsername: 'person-github',
      googleEmail: 'drive@example.com',
      codaEmail: 'coda@example.com',
    });
  });

  it.each([
    ['legacy-first', 'person.name'],
    ['username-first', 'person.name'],
    ['legacy-first', ''],
    ['username-first', ''],
  ])(
    'keeps Discord ID and username distinct with %s columns and username %j',
    async (order, username) => {
      const legacyId = '123456789012345678';
      const accountHeaders =
        order === 'legacy-first'
          ? ['ID Discord', 'Username Discord']
          : ['Username Discord', 'ID Discord'];
      const accounts =
        order === 'legacy-first' ? [legacyId, username] : [username, legacyId];
      http.request.mockResolvedValue({
        values: [
          ['Nome', 'Email', 'Departamento', ...accountHeaders],
          ['Pessoa', 'person@example.com', 'Informática', ...accounts],
        ],
      });
      const [row] = await intake.responses();
      expect(row.accounts).toMatchObject({
        discordId: legacyId,
        discordUsername: username,
      });
    },
  );

  it.each(['configured.person', ''])(
    'pins a configured Discord username column, including a blank value %j',
    async (username) => {
      const legacyId = '123456789012345678';
      process.env.ACCESS_SHEETS_COLUMNS = JSON.stringify({
        discordUsername: 'Conta Discord escolhida',
      });
      http.request.mockResolvedValue({
        values: [
          [
            'Nome',
            'Email',
            'Departamento',
            'ID Discord',
            'Username Discord',
            'Conta Discord escolhida',
          ],
          [
            'Pessoa',
            'person@example.com',
            'Informática',
            legacyId,
            'other.person',
            username,
          ],
        ],
      });
      const [row] = await intake.responses();
      expect(row.accounts).toMatchObject({
        discordId: legacyId,
        discordUsername: username,
      });
    },
  );

  it('preserves an explicitly mapped numeric username in the old heading without labelling it a legacy ID', async () => {
    process.env.ACCESS_SHEETS_COLUMNS = JSON.stringify({
      discordUsername: 'ID Discord',
    });
    const username = '123456789012345678';
    http.request.mockResolvedValue({
      values: [
        ['Nome', 'Email', 'Departamento', 'ID Discord'],
        ['Pessoa', 'person@example.com', 'Informática', username],
      ],
    });
    const [row] = await intake.responses();
    expect(row.accounts).toMatchObject({
      discordId: '',
      discordUsername: username,
    });
  });

  it('prioritizes configured columns over aliases regardless of sheet order', async () => {
    process.env.ACCESS_SHEETS_COLUMNS = JSON.stringify({
      email: 'Contacto escolhido',
    });
    http.request.mockResolvedValue({
      values: [
        ['Nome', 'Email', 'Departamento', 'Contacto escolhido'],
        ['Pessoa', 'old@example.com', 'Informática', 'person@example.com'],
      ],
    });
    expect((await intake.responses())[0].email).toBe('person@example.com');
  });

  it('reads the first nonempty conditional username without borrowing the legacy ID', async () => {
    const legacyId = '123456789012345678';
    http.request.mockResolvedValue({
      values: [
        [
          'Nome',
          'Email',
          'Departamento',
          'ID Discord',
          'Username Discord',
          'Username Discord',
        ],
        [
          'Pessoa',
          'person@example.com',
          'Informática',
          legacyId,
          '',
          'person.name',
        ],
      ],
    });
    const [row] = await intake.responses();
    expect(row.accounts).toMatchObject({
      discordId: legacyId,
      discordUsername: 'person.name',
    });
  });
});
