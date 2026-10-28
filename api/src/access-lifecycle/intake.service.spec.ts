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
});
