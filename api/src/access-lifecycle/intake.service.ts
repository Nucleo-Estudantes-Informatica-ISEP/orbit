import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ProviderHttp } from './provider-http';

export const normalizeIntakeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
const labelKey = (value: string) =>
  normalizeIntakeText(value).replace(/[^a-z0-9]/g, '');
const aliases: Record<string, string[]> = {
  name: ['Nome e Apelido', 'Nome'],
  email: ['E-Mail Pessoal', 'Email'],
  departments: ['Departamento', 'Departamentos'],
  positions: ['Cargo', 'Cargos'],
  discordId: ['ID Discord', 'Discord ID'],
  discordUsername: ['Username Discord', 'ID Discord', 'Discord ID'],
  githubId: ['GitHub ID'],
  githubUsername: ['Username GitHub', 'Utilizador GitHub', 'GitHub'],
  googleEmail: ['Email Google', 'E-mail Google'],
  phone: ['Nº Telemóvel', 'Telefone'],
  figmaEmail: ['Email Figma'],
  codaEmail: ['Email Coda'],
  freedcampEmail: ['Email Freedcamp'],
  institutionalEmail: ['E-mail NEI'],
};
const declaredPositions: Record<string, string> = {
  membro: 'MEMBER',
  coordenador: 'COORDINATOR',
  coordenadora: 'COORDINATOR',
  coordenacao: 'COORDINATOR',
  cocoordenador: 'CO_COORDINATOR',
  cocoordenadora: 'CO_COORDINATOR',
  cocoordenacao: 'CO_COORDINATOR',
  direcao: 'BOARD',
  tesoureiro: 'BOARD',
  tesoureira: 'BOARD',
  presidencia: 'PRESIDENCY',
  presidente: 'PRESIDENCY',
  vicepresidente: 'PRESIDENCY',
  alumni: 'ALUMNI',
};

export interface IntakeResponse {
  key: string;
  name: string;
  email: string;
  departmentIds: string[];
  positions: string[];
  accounts: Record<string, string>;
}

@Injectable()
export class IntakeService {
  constructor(private readonly http: ProviderHttp) {}

  get configured() {
    return Boolean(
      process.env.ACCESS_SHEETS_ID && process.env.ACCESS_SHEETS_RANGE,
    );
  }

  async responses(): Promise<IntakeResponse[]> {
    if (!this.configured)
      throw new ServiceUnavailableException(
        'Forms/Sheets ainda não configurado',
      );
    const spreadsheet = process.env.ACCESS_SHEETS_ID!;
    const range = process.env.ACCESS_SHEETS_RANGE!;
    // Only a server-configured bounded range is accepted; clients cannot select another sheet.
    if (!/\d+$/.test(range))
      throw new ServiceUnavailableException(
        'ACCESS_SHEETS_RANGE exige última linha explícita',
      );
    let columns: Record<string, string>;
    let departments: Record<string, string>;
    let positions: Record<string, string>;
    try {
      columns = JSON.parse(
        process.env.ACCESS_SHEETS_COLUMNS ||
          '{"name":"Nome","email":"Email","departments":"Departamentos","positions":"Cargos","discordId":"Discord ID","githubId":"GitHub ID","googleEmail":"Email Google","phone":"Telefone","figmaEmail":"Email Figma"}',
      ) as Record<string, string>;
      departments = JSON.parse(
        process.env.ACCESS_SHEETS_DEPARTMENTS || '{}',
      ) as Record<string, string>;
      positions = JSON.parse(
        process.env.ACCESS_SHEETS_POSITIONS || '{}',
      ) as Record<string, string>;
      if (
        !positions ||
        typeof positions !== 'object' ||
        Array.isArray(positions)
      )
        throw new Error('Invalid positions mapping');
    } catch {
      throw new ServiceUnavailableException('Mapeamento Sheets inválido');
    }
    const result = await this.http.request<{ values?: string[][] }>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheet)}/values/${encodeURIComponent(range)}`,
      await this.http.google('sheets'),
    );
    const [headers, ...rows] = result?.values || [];
    const indices = (field: string) =>
      (headers || []).flatMap((header, index) =>
        [columns[field], ...(aliases[field] || [])]
          .filter(Boolean)
          .some((name) => labelKey(name) === labelKey(header))
          ? [index]
          : [],
      );
    if (
      !headers ||
      ['name', 'email', 'departments'].some((field) => !indices(field).length)
    )
      throw new ServiceUnavailableException(
        'Colunas obrigatórias em falta no Sheets',
      );
    const get = (row: string[], field: string) =>
      indices(field)
        .map((index) => String(row[index] || '').trim())
        .find(Boolean) || '';
    const departmentMap = Object.fromEntries(
      Object.entries(departments).map(([label, id]) => [labelKey(label), id]),
    );
    const positionMap = {
      ...declaredPositions,
      ...Object.fromEntries(
        Object.entries(positions).map(([label, id]) => [labelKey(label), id]),
      ),
    };
    const split = (value: string) =>
      value
        .split(/[,;\n]/)
        .map((v) => v.trim())
        .filter(Boolean);
    return rows
      .filter((row) => get(row, 'name') && get(row, 'email'))
      .map((row) => ({
        key: createHash('sha256')
          .update(JSON.stringify([spreadsheet, range, row]))
          .digest('hex'),
        name: get(row, 'name'),
        email: get(row, 'email').toLowerCase(),
        departmentIds: split(get(row, 'departments')).map(
          (value) => departmentMap[labelKey(value)] || value,
        ),
        positions: split(get(row, 'positions')).map(
          (value) => positionMap[labelKey(value)] || value,
        ),
        accounts: Object.fromEntries(
          [
            'discordId',
            'discordUsername',
            'githubId',
            'githubUsername',
            'googleEmail',
            'phone',
            'figmaEmail',
            'codaEmail',
            'freedcampEmail',
            'institutionalEmail',
          ].map((field) => [
            field,
            field === 'discordUsername' &&
            /^\d{15,22}$/.test(get(row, field)) &&
            !columns.discordUsername &&
            !headers.some((header) => labelKey(header) === 'usernamediscord')
              ? ''
              : get(row, field),
          ]),
        ),
      }));
  }

  async find(key: string) {
    const matches = (await this.responses()).filter((row) => row.key === key);
    if (matches.length !== 1)
      throw new BadRequestException(
        'Resposta ausente, alterada ou ambígua; voltar a consultar Sheets',
      );
    return matches[0];
  }
}
