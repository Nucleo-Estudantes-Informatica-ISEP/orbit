import { createHash } from 'node:crypto';
import {
  AccessProvider,
  Prisma,
  PrismaClient,
  SystemPermission,
} from '@prisma/client';
import {
  AccessBootstrap,
  applyAccessBootstrapTransaction,
  readAccessBootstrap,
  initialAccessBootstrap,
} from '../src/access-lifecycle/bootstrap.config';

const idFor = (key: string) => {
  const hex = createHash('sha256').update(`orbit:access:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
export const accessSeedMarkerId = idFor('initialization:v1');

async function initializeAccessDefaults(
  prisma: Prisma.TransactionClient,
  bootstrap: AccessBootstrap,
) {
  // Serialize overlapping seed runs. A failure rolls back the entire catalogue,
  // ADMIN grant, bootstrap and marker; a retry never sees this run's partial rows.
  await prisma.$queryRaw`SELECT pg_advisory_xact_lock(1869769058, 113)::text`;
  const marker = await prisma.auditLog.findUnique({
    where: { id: accessSeedMarkerId },
  });
  // Preserve installations seeded before markers existed. Row counts are only
  // used for this one-time legacy adoption, never as the completion marker.
  const legacy = !marker && (await prisma.accessResource.count()) > 0;
  const firstInitialization = !marker && !legacy;
  const createdKeys = new Set<string>();
  const departments = await prisma.department.findMany();
  const normalized = (name: string) =>
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const department = (name: string) =>
    departments.find((value) => normalized(value.name) === normalized(name))
      ?.id;
  const resources: Record<string, string> = {};
  const add = async (
    key: string,
    name: string,
    provider: AccessProvider,
    type: string,
    sensitive = false,
    instructions = '',
  ) => {
    const id = idFor(key);
    resources[key] = id;
    if (
      !(await prisma.accessResource.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      createdKeys.add(key);
    await prisma.accessResource.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name,
        provider,
        resourceType: type,
        remoteId: 'CONFIGURE_ME',
        automatic: ['DISCORD', 'GITHUB', 'GOOGLE_DRIVE'].includes(provider),
        sensitive,
        enabled: true,
        instructions:
          instructions ||
          (provider === 'DISCORD'
            ? 'Orbit resolve o username ao criar o pedido e atribui/remove o cargo da conta aprovada, incluindo cargos administrativos abaixo do bot. Se a conta não foi identificada, tratar manualmente com evidência ou criar novo pedido após a entrada no servidor; repetir nunca associa outra conta.'
            : provider === 'GOOGLE_DRIVE'
              ? 'Orbit identifica a conta pelo email Google, concede escrita ou revoga a permissão aprovada e confirma o resultado. Configurar a pasta; se faltar o destino, o responsável deve tratar o passo manualmente e registar evidência.'
              : provider === 'WHATSAPP'
                ? 'Após aprovação, adicionar/convidar o número indicado ao grupo correspondente e confirmar adesão; na saída remover e confirmar. Se faltar link, contactar o administrador do grupo e registar evidência.'
                : 'Configurar o destino do recurso na administração; executar a ação aprovada para a conta indicada e confirmar o resultado.'),
      },
    });
  };
  await add('discord-members', 'Discord · Members', 'DISCORD', 'DISCORD_ROLE');
  await add(
    'discord-board',
    'Discord · Direção',
    'DISCORD',
    'DISCORD_ROLE',
    true,
  );
  await add(
    'discord-presidency',
    'Discord · Presi',
    'DISCORD',
    'DISCORD_ROLE',
    true,
  );
  await add(
    'discord-coordinator',
    'Discord · Coordenadores',
    'DISCORD',
    'DISCORD_ROLE',
  );
  await add(
    'discord-co-coordinator',
    'Discord · Co-coordenador',
    'DISCORD',
    'DISCORD_ROLE',
  );
  await add('discord-alumni', 'Discord · Alumni', 'DISCORD', 'DISCORD_ROLE');
  await add(
    'discord-server-manager',
    'Discord · server-manager',
    'DISCORD',
    'DISCORD_ROLE',
    true,
    'Exceção sensível: justificar acesso e obter aprovação. Orbit atribui/remove automaticamente se o cargo estiver abaixo do bot; nunca incluir por defeito.',
  );
  await add('drive-general', 'Drive · Geral', 'GOOGLE_DRIVE', 'DRIVE_FOLDER');
  await add(
    'drive-board',
    'Drive · Direção',
    'GOOGLE_DRIVE',
    'DRIVE_FOLDER',
    true,
    'Orbit gere a permissão aprovada pelo email Google. Revogar acesso direto na pasta e descendentes; se persistir herança/grupos, identificar a origem e registar o passo ainda necessário.',
  );
  await add(
    'drive-presidency',
    'Drive · Presidência',
    'GOOGLE_DRIVE',
    'DRIVE_FOLDER',
    true,
    'Presidência: configurar a pasta e partilhá-la com a service account. Até existir destino, um responsável da Presidência deve adicionar/remover o email Google na pasta e confirmar em evidência. Com destino configurado, Orbit gere a permissão automaticamente.',
  );
  await add('github', 'GitHub · Organização', 'GITHUB', 'GITHUB_ORG');
  await add(
    'figma',
    'Figma · Team',
    'FIGMA',
    'FIGMA_TEAM',
    false,
    'Convidar conta verificada para a team Figma. Convite enviado: aguarda aceitação. Só concluir depois de confirmar pertença. Offboarding: remover da team e confirmar.',
  );
  await add(
    'coda',
    'Coda · Team Relações Externas',
    'CODA',
    'MANUAL',
    false,
    'No Coda, um administrador abre as definições de membros da team de Relações Externas e convida o email indicado. Registar convite enviado como aguarda conta; só concluir após aceitação. Na saída remover da team e confirmar. Se faltar link, pedir acesso ao responsável de Relações Externas; o passo mantém-se manual.',
  );
  await add(
    'freedcamp',
    'Freedcamp · Team Marketing',
    'FREEDCAMP',
    'MANUAL',
    false,
    'No Freedcamp, um administrador abre a gestão da team de Marketing e convida o email indicado. Registar envio como aguarda conta; só concluir após aceitação. Na saída remover da team e confirmar. Se faltar link, contactar o responsável de Marketing; o passo mantém-se manual.',
  );
  await add(
    'whatsapp-community',
    'WhatsApp · Comunidade',
    'WHATSAPP',
    'WHATSAPP_GROUP',
    false,
    'Partilhar convite após aprovação; confirmar adesão ou remoção manual.',
  );
  await add(
    'whatsapp-general',
    'WhatsApp · Geral',
    'WHATSAPP',
    'WHATSAPP_GROUP',
    false,
    'Adesão à comunidade não garante entrada no Geral; verificar separadamente.',
  );
  await add(
    'whatsapp-board',
    'WhatsApp · Rubis',
    'WHATSAPP',
    'WHATSAPP_GROUP',
    true,
  );
  await add(
    'whatsapp-alumni',
    'WhatsApp · Alumínios',
    'WHATSAPP',
    'WHATSAPP_GROUP',
    false,
    'Na transição Alumni, manter contacto no WhatsApp: convidar/adicionar o número ao grupo Alumínios e confirmar adesão. Se faltar link, contactar o administrador do grupo; o passo continua manual e visível. Só remover este contacto num pedido explícito aprovado.',
  );
  await add(
    'email',
    'Email institucional',
    'EMAIL',
    'MANUAL',
    true,
    'Só mediante pedido explícito aprovado. No cPanel > Contas de email, criar/atualizar o endereço NEI indicado e enviar instruções de acesso por canal privado. Na saída suspender login e envio/receção conforme decisão; preservar mailbox/conteúdo. Confirmar o resultado em evidência, sem passwords ou tokens.',
  );
  const policy = async (
    key: string,
    name: string,
    keys: string[],
    departmentIds: string[] = [],
    positions: string[] = [],
  ) =>
    prisma.accessPolicy.upsert({
      where: { id: idFor(`policy:${key}`) },
      update: {},
      create: {
        id: idFor(`policy:${key}`),
        name,
        departmentIds,
        positions,
        resourceIds: keys.map((key) => resources[key]),
        enabled: true,
      },
    });
  const active = [
    'MEMBER',
    'COORDINATOR',
    'CO_COORDINATOR',
    'BOARD',
    'PRESIDENCY',
  ];
  await policy(
    'active',
    'Membros ativos',
    [
      'discord-members',
      'drive-general',
      'whatsapp-community',
      'whatsapp-general',
    ],
    [],
    active,
  );
  await policy(
    'coordinator',
    'Coordenação',
    ['discord-coordinator', 'github'],
    [],
    ['COORDINATOR'],
  );
  await policy(
    'co-coordinator',
    'Co-coordenação',
    ['discord-co-coordinator', 'github'],
    [],
    ['CO_COORDINATOR'],
  );
  await policy(
    'board',
    'Direção e Presidência',
    ['discord-board', 'drive-board', 'whatsapp-board'],
    [],
    ['BOARD', 'PRESIDENCY'],
  );
  await policy(
    'presidency',
    'Presidência',
    ['discord-presidency', 'drive-presidency'],
    [],
    ['PRESIDENCY'],
  );
  await policy(
    'alumni',
    'Alumni (transição explícita)',
    ['discord-alumni', 'whatsapp-alumni'],
    [],
    ['ALUMNI'],
  );
  for (const current of departments) {
    const key = `department:${current.id}`;
    if (normalized(current.name) === 'direcao')
      resources[`discord:${key}`] = resources['discord-board'];
    else
      await add(
        `discord:${key}`,
        `Discord · ${current.name}`,
        'DISCORD',
        'DISCORD_ROLE',
      );
    await add(
      `whatsapp:${key}`,
      `WhatsApp · ${current.name}`,
      'WHATSAPP',
      'WHATSAPP_GROUP',
    );
    await policy(
      key,
      `Departamento · ${current.name}`,
      [`discord:${key}`, `whatsapp:${key}`],
      [current.id],
      active,
    );
  }
  const it =
    department('Informática') || department('Infraestruturas Informáticas');
  const marketing = department('Marketing');
  const external = department('Relações Externas');
  if (it)
    await policy(
      'it-tools',
      'Informática · GitHub e Figma',
      ['github', 'figma'],
      [it],
      active,
    );
  if (marketing)
    await policy(
      'marketing-tools',
      'Marketing · Figma e Freedcamp',
      ['figma', 'freedcamp'],
      [marketing],
      active,
    );
  if (external)
    await policy(
      'external-tools',
      'Relações Externas · Coda',
      ['coda'],
      [external],
      active,
    );
  const admin =
    firstInitialization && !bootstrap.rolePermissions
      ? await prisma.role.findUnique({ where: { name: 'ADMIN' } })
      : null;
  if (admin)
    await prisma.role.update({
      where: { id: admin.id },
      data: {
        permissions: [
          ...new Set([
            ...admin.permissions,
            ...Object.values(SystemPermission).filter((value) =>
              value.startsWith('ACCESS_'),
            ),
          ]),
        ],
      },
    });
  const selected = initialAccessBootstrap(
    bootstrap,
    createdKeys,
    firstInitialization,
  );
  await applyAccessBootstrapTransaction(prisma, resources, selected);
  if (!marker)
    await prisma.auditLog.create({
      data: {
        id: accessSeedMarkerId,
        action: legacy
          ? 'ACCESS_DEFAULTS_LEGACY_ADOPTED'
          : 'ACCESS_DEFAULTS_INITIALIZED',
        entity: 'AccessDefaults',
        entityId: 'v1',
      },
    });
  return {
    legacy,
    skippedResources:
      Object.keys(bootstrap.resources).length -
      Object.keys(selected.resources).length,
    skippedRoles: selected.rolePermissions
      ? 0
      : Object.keys(bootstrap.rolePermissions || {}).length,
  };
}

export async function seedAccessDefaults(
  client: PrismaClient,
  bootstrap: AccessBootstrap = readAccessBootstrap(process.env),
  report: (message: string) => void = console.log,
) {
  const summary = await client.$transaction(
    (tx) => initializeAccessDefaults(tx, bootstrap),
    { maxWait: 10_000, timeout: 60_000 },
  );
  if (summary.legacy)
    report(
      'Access seed adopted an existing catalogue without reapplying role permissions; review any unfinished legacy setup in administration.',
    );
  if (summary.skippedResources || summary.skippedRoles)
    report(
      `Access bootstrap skipped ${summary.skippedResources} existing resource entries and ${summary.skippedRoles} role entries; UI configuration is authoritative. Change these entries in administration, not bootstrap env. No values logged.`,
    );
  report(
    'Access policies initialized. Unconfigured resources retain manual instructions; automatic changes require configured destinations. Existing policies are preserved. No member or user accounts created.',
  );
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedAccessDefaults(prisma)
    .catch(() => {
      console.error('Access policy seed failed');
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
