import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ProviderHttp } from './provider-http';

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
    try {
      columns = JSON.parse(
        process.env.ACCESS_SHEETS_COLUMNS ||
          '{"name":"Nome","email":"Email","departments":"Departamentos","positions":"Cargos","discordId":"Discord ID","githubId":"GitHub ID","googleEmail":"Email Google","phone":"Telefone","figmaEmail":"Email Figma"}',
      ) as Record<string, string>;
      departments = JSON.parse(
        process.env.ACCESS_SHEETS_DEPARTMENTS || '{}',
      ) as Record<string, string>;
    } catch {
      throw new ServiceUnavailableException('Mapeamento Sheets inválido');
    }
    const result = await this.http.request<{ values?: string[][] }>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheet)}/values/${encodeURIComponent(range)}`,
      await this.http.google('sheets'),
    );
    const [headers, ...rows] = result?.values || [];
    if (
      !headers ||
      !headers.includes(columns.name) ||
      !headers.includes(columns.email) ||
      !headers.includes(columns.departments)
    )
      throw new ServiceUnavailableException(
        'Colunas obrigatórias em falta no Sheets',
      );
    const get = (row: string[], field: string) =>
      String(row[headers.indexOf(columns[field])] || '').trim();
    const split = (value: string) =>
      value
        .split(/[,;]/)
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
          (value) => departments[value] || value,
        ),
        positions: split(get(row, 'positions')),
        accounts: Object.fromEntries(
          ['discordId', 'githubId', 'googleEmail', 'phone', 'figmaEmail'].map(
            (field) => [field, get(row, field)],
          ),
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
