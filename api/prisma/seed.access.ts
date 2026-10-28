import { createHash } from 'node:crypto';
import { AccessProvider, PrismaClient, SystemPermission } from '@prisma/client';
import {
  applyAccessBootstrap,
  readAccessBootstrap,
} from '../src/access-lifecycle/bootstrap.config';

const prisma = new PrismaClient();
const idFor = (key: string) => {
  const hex = createHash('sha256').update(`orbit:access:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

async function main() {
  const bootstrap = readAccessBootstrap(process.env);
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
    await prisma.accessResource.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name,
        provider,
        resourceType: type,
        remoteId: 'CONFIGURE_ME',
        automatic: false,
        sensitive,
        enabled: false,
        instructions:
          instructions ||
          'Configurar identificadores e instruções; confirmar execução na plataforma.',
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
    'Atribuição/revogação manual por administrador autorizado; nunca incluir por defeito.',
  );
  await add('drive-general', 'Drive · Geral', 'GOOGLE_DRIVE', 'DRIVE_FOLDER');
  await add(
    'drive-board',
    'Drive · Direção',
    'GOOGLE_DRIVE',
    'DRIVE_FOLDER',
    true,
    'Confirmar acesso limitado e auditar herança; rever grants em descendentes.',
  );
  await add(
    'drive-presidency',
    'Drive · Presidência',
    'GOOGLE_DRIVE',
    'DRIVE_FOLDER',
    true,
    'Confirmar acesso limitado e auditar organizer/herança antes de ativar automação.',
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
    'Coda · Relações Externas (por confirmar)',
    'CODA',
    'MANUAL',
    false,
    'Estrutura, plano e permissões por confirmar. Manter desativado até definição explícita; execução manual com evidência.',
  );
  await add(
    'freedcamp',
    'Freedcamp · Marketing (por confirmar)',
    'FREEDCAMP',
    'MANUAL',
    false,
    'Estrutura, plano e permissões por confirmar. Manter desativado até definição explícita; execução manual com evidência.',
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
  );
  await add(
    'email',
    'Email institucional',
    'EMAIL',
    'MANUAL',
    true,
    'Só mediante pedido explícito. Gestão manual cPanel; nunca guardar passwords na evidência nem apagar mailbox/conteúdo neste fluxo.',
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
  const admin = !bootstrap.rolePermissions
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
  await applyAccessBootstrap(prisma, resources, bootstrap);
  console.log(
    'Access policies initialized and explicit bootstrap applied. Unconfigured resources remain disabled. No member or user accounts created.',
  );
}

main()
  .catch(() => {
    console.error('Access policy seed failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
