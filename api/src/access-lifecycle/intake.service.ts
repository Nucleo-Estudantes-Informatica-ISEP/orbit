import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ProviderHttp } from './provider-http';
import { throwProviderFailure } from './provider-failure';

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
  name: ['Nome e Apelido', 'Nome', 'Nome completo'],
  email: ['E-Mail Pessoal', 'Email'],
  departments: ['Departamento', 'Departamentos'],
  positions: ['Cargo', 'Cargos'],
  discordId: ['ID Discord', 'Discord ID'],
  discordUsername: ['Username Discord'],
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

export type IntakeSource = 'FORMS' | 'SHEETS';
export interface IntakeResponse {
  source: IntakeSource;
  submittedAt?: string;
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

  get sources(): IntakeSource[] {
    const sources: IntakeSource[] = [];
    if (process.env.ACCESS_FORMS_ID) sources.push('FORMS');
    if (process.env.ACCESS_SHEETS_ID && process.env.ACCESS_SHEETS_RANGE)
      sources.push('SHEETS');
    return sources;
  }

  get configured() {
    return this.sources.length > 0;
  }

  async responses(
    source: IntakeSource | undefined = this.sources[0],
  ): Promise<IntakeResponse[]> {
    if (!source || !this.sources.includes(source))
      throw new ServiceUnavailableException(
        'Origem de dados ainda não configurada',
      );
    try {
      return source === 'FORMS'
        ? await this.formsResponses()
        : await this.sheetResponses();
    } catch (error) {
      throwProviderFailure(error);
    }
  }

  private mapping(name: string): Record<string, string> {
    try {
      const value: unknown = JSON.parse(process.env[name] || '{}');
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.values(value).some((entry) => typeof entry !== 'string')
      )
        throw new Error('Invalid mapping');
      return value as Record<string, string>;
    } catch {
      throw new ServiceUnavailableException(`Mapeamento ${name} inválido`);
    }
  }

  private async sheetResponses(): Promise<IntakeResponse[]> {
    const spreadsheet = process.env.ACCESS_SHEETS_ID!;
    const range = process.env.ACCESS_SHEETS_RANGE!;
    // Only a server-configured bounded range is accepted; clients cannot select another sheet.
    if (!/\d+$/.test(range))
      throw new ServiceUnavailableException(
        'ACCESS_SHEETS_RANGE exige última linha explícita',
      );
    const result = await this.http.request<{ values?: string[][] }>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheet)}/values/${encodeURIComponent(range)}`,
      await this.http.google('sheets'),
    );
    const [headers, ...rows] = result?.values || [];
    return this.parseRows(
      (headers || []).map((header) => [header]),
      rows,
      rows.map((row) =>
        createHash('sha256')
          .update(JSON.stringify([spreadsheet, range, row]))
          .digest('hex'),
      ),
      'SHEETS',
      this.mapping('ACCESS_SHEETS_COLUMNS'),
    );
  }

  private async formsResponses(): Promise<IntakeResponse[]> {
    const form = process.env.ACCESS_FORMS_ID!;
    if (!/^[\w-]{10,200}$/.test(form))
      throw new ServiceUnavailableException(
        'ACCESS_FORMS_ID inválido; usar o ID do URL de edição',
      );
    const token = await this.http.google('forms');
    const root = `https://forms.googleapis.com/v1/forms/${encodeURIComponent(form)}`;
    type Question = { questionId: string; rowQuestion?: { title?: string } };
    const definition = await this.http.request<{
      items?: {
        title?: string;
        questionItem?: { question?: Question };
        questionGroupItem?: { questions?: Question[] };
      }[];
    }>(root, token);
    if (!definition?.items)
      throw new ServiceUnavailableException('Estrutura Forms indisponível');
    const questions = definition.items.flatMap((item) => {
      const entries = item.questionItem?.question
        ? [item.questionItem.question]
        : item.questionGroupItem?.questions || [];
      return entries.map((question) => ({
        id: question.questionId,
        title: question.rowQuestion?.title || item.title || '',
      }));
    });
    type Response = {
      responseId: string;
      respondentEmail?: string;
      lastSubmittedTime?: string;
      answers?: Record<
        string,
        { textAnswers?: { answers?: { value?: string }[] } }
      >;
    };
    const responses: Response[] = [];
    const seen = new Set<string>();
    let page = '';
    do {
      if (seen.has(page) || seen.size >= 20)
        throw new ServiceUnavailableException(
          'Limite de paginação Forms atingido; consultar o responsável pela integração',
        );
      seen.add(page);
      const result = await this.http.request<{
        responses?: Response[];
        nextPageToken?: string;
      }>(
        `${root}/responses?pageSize=500&pageToken=${encodeURIComponent(page)}`,
        token,
      );
      if (!result)
        throw new ServiceUnavailableException('Respostas Forms indisponíveis');
      responses.push(...(result.responses || []));
      page = result.nextPageToken || '';
    } while (page);
    const rows = responses.map((response) => [
      ...questions.map((question) =>
        (response.answers?.[question.id]?.textAnswers?.answers || [])
          .map((answer) => answer.value || '')
          .join(', '),
      ),
      response.respondentEmail || '',
    ]);
    const keys = responses.map((response, index) =>
      createHash('sha256')
        .update(
          JSON.stringify([
            'FORMS',
            form,
            response.responseId,
            response.lastSubmittedTime,
            rows[index],
          ]),
        )
        .digest('hex'),
    );
    const submittedAt = new Map(
      keys.map((key, index) => [key, responses[index].lastSubmittedTime]),
    );
    return this.parseRows(
      [
        ...questions.map((question) => [question.title, question.id]),
        ['Email', 'respondentEmail'],
      ],
      rows,
      keys,
      'FORMS',
      this.mapping('ACCESS_FORMS_FIELDS'),
      new Set(questions.map((question) => question.id)),
    )
      .map((row) => ({ ...row, submittedAt: submittedAt.get(row.key) }))
      .sort(
        (left, right) =>
          (Date.parse(right.submittedAt || '') || 0) -
          (Date.parse(left.submittedAt || '') || 0),
      );
  }

  private parseRows(
    headers: string[][],
    rows: string[][],
    keys: string[],
    source: IntakeSource,
    columns: Record<string, string>,
    questionIds = new Set<string>(),
  ): IntakeResponse[] {
    const departments = this.mapping('ACCESS_SHEETS_DEPARTMENTS');
    const positions = this.mapping('ACCESS_SHEETS_POSITIONS');
    const normalizedHeaders = headers.map((labels) => labels.map(labelKey));
    const fieldIndices = new Map(
      [...new Set([...Object.keys(aliases), ...Object.keys(columns)])].map(
        (field) => {
          const accepted = (
            questionIds.has(columns[field])
              ? [columns[field]]
              : [columns[field], ...(aliases[field] || [])]
          )
            .filter(Boolean)
            .map(labelKey);
          return [
            field,
            [
              ...new Set(
                accepted.flatMap((label) =>
                  normalizedHeaders.flatMap((header, index) =>
                    header.includes(label) ? [index] : [],
                  ),
                ),
              ),
            ],
          ] as const;
        },
      ),
    );
    const usernameMapping = columns.discordUsername?.trim();
    const usernameLabel = labelKey(usernameMapping || 'Username Discord');
    const explicitUsernameIndices = normalizedHeaders.flatMap(
      (labels, index) => (labels.includes(usernameLabel) ? [index] : []),
    );
    const hasExplicitDiscordUsername = Boolean(
      usernameMapping || explicitUsernameIndices.length,
    );
    const legacyDiscordIndices = fieldIndices.get('discordId') || [];
    if (hasExplicitDiscordUsername) {
      // A blank username stays blank; borrowing the legacy ID would change its identity type.
      fieldIndices.set('discordUsername', explicitUsernameIndices);
      const usernameColumns = new Set(explicitUsernameIndices);
      fieldIndices.set(
        'discordId',
        legacyDiscordIndices.filter((index) => !usernameColumns.has(index)),
      );
    } else {
      // Older sources may store either a numeric ID or a username in the old ID heading.
      fieldIndices.set('discordUsername', legacyDiscordIndices);
    }
    const indices = (field: string) => fieldIndices.get(field) || [];
    if (
      ['name', 'email', 'departments'].some((field) => !indices(field).length)
    )
      throw new ServiceUnavailableException(
        `Colunas obrigatórias em falta na origem ${source}`,
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
    return rows.flatMap((row, index) =>
      !get(row, 'name') || !get(row, 'email')
        ? []
        : [
            {
              source,
              key: keys[index],
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
                  !hasExplicitDiscordUsername
                    ? ''
                    : get(row, field),
                ]),
              ),
            },
          ],
    );
  }

  async find(key: string, source?: IntakeSource): Promise<IntakeResponse> {
    let failure: Error | undefined;
    for (const origin of source ? [source] : this.sources) {
      try {
        const matches = (await this.responses(origin)).filter(
          (row) => row.key === key,
        );
        if (matches.length > 1)
          throw new BadRequestException(
            'Resposta ausente, alterada ou ambígua; voltar a consultar a origem',
          );
        if (matches.length === 1) return matches[0];
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        failure ??=
          error instanceof Error
            ? error
            : new ServiceUnavailableException('Origem de dados indisponível');
      }
    }
    if (failure) throw failure;
    throw new BadRequestException(
      'Resposta ausente, alterada ou ambígua; voltar a consultar a origem',
    );
  }
}
