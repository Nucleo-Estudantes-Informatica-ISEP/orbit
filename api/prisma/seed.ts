// @ts-nocheck
import {
  PrismaClient,
  UserStatus,
  SystemPermission,
  Priority,
  TaskStatus,
  ProjectStatus,
  RecruitmentStage,
  Visibility,
  PlanStatus,
  DebtType,
  DebtStatus,
} from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─── helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── permissions ────────────────────────────────────────────────────────────

const ALL_PERMISSIONS: SystemPermission[] = [
  SystemPermission.USERS_VIEW, SystemPermission.USERS_CREATE, SystemPermission.USERS_READ,
  SystemPermission.USERS_UPDATE, SystemPermission.USERS_DELETE,
  SystemPermission.ROLES_VIEW, SystemPermission.ROLES_CREATE, SystemPermission.ROLES_READ,
  SystemPermission.ROLES_UPDATE, SystemPermission.ROLES_DELETE,
  SystemPermission.DEPARTMENTS_VIEW, SystemPermission.DEPARTMENTS_CREATE, SystemPermission.DEPARTMENTS_READ,
  SystemPermission.DEPARTMENTS_UPDATE, SystemPermission.DEPARTMENTS_DELETE,
  SystemPermission.ANNOUNCEMENTS_VIEW, SystemPermission.ANNOUNCEMENTS_CREATE, SystemPermission.ANNOUNCEMENTS_READ,
  SystemPermission.ANNOUNCEMENTS_UPDATE, SystemPermission.ANNOUNCEMENTS_DELETE,
  SystemPermission.EVENTS_VIEW, SystemPermission.EVENTS_CREATE, SystemPermission.EVENTS_READ,
  SystemPermission.EVENTS_UPDATE, SystemPermission.EVENTS_DELETE,
  SystemPermission.TASKS_VIEW, SystemPermission.TASKS_CREATE, SystemPermission.TASKS_READ,
  SystemPermission.TASKS_UPDATE, SystemPermission.TASKS_DELETE,
  SystemPermission.RECRUITMENT_VIEW, SystemPermission.RECRUITMENT_CREATE, SystemPermission.RECRUITMENT_READ,
  SystemPermission.RECRUITMENT_UPDATE, SystemPermission.RECRUITMENT_DELETE,
  SystemPermission.PROJECTS_VIEW, SystemPermission.PROJECTS_CREATE, SystemPermission.PROJECTS_READ,
  SystemPermission.PROJECTS_UPDATE, SystemPermission.PROJECTS_DELETE,
  SystemPermission.RESOURCES_VIEW, SystemPermission.RESOURCES_CREATE, SystemPermission.RESOURCES_READ,
  SystemPermission.RESOURCES_UPDATE, SystemPermission.RESOURCES_DELETE,
  SystemPermission.BOARDS_VIEW, SystemPermission.BOARDS_CREATE, SystemPermission.BOARDS_READ,
  SystemPermission.BOARDS_UPDATE, SystemPermission.BOARDS_DELETE,
  SystemPermission.INVENTORY_VIEW, SystemPermission.INVENTORY_CREATE, SystemPermission.INVENTORY_READ,
  SystemPermission.INVENTORY_UPDATE, SystemPermission.INVENTORY_DELETE,
  SystemPermission.PLANS_VIEW, SystemPermission.PLANS_CREATE, SystemPermission.PLANS_READ,
  SystemPermission.PLANS_UPDATE, SystemPermission.PLANS_DELETE, SystemPermission.PLANS_APPROVE,
  SystemPermission.FILES_UPLOAD, SystemPermission.FILES_VIEW, SystemPermission.FILES_DELETE,
  SystemPermission.DEBTS_VIEW, SystemPermission.DEBTS_CREATE, SystemPermission.DEBTS_READ,
  SystemPermission.DEBTS_UPDATE, SystemPermission.DEBTS_DELETE,
  SystemPermission.AUDITS_READ,
  SystemPermission.INCIDENTS_VIEW, SystemPermission.INCIDENTS_CREATE, SystemPermission.INCIDENTS_READ,
  SystemPermission.INCIDENTS_UPDATE, SystemPermission.INCIDENTS_DELETE,
  SystemPermission.CAN_BE_DELETED,
]

const COORDINATOR_PERMISSIONS: SystemPermission[] = [
  SystemPermission.USERS_VIEW, SystemPermission.USERS_READ, SystemPermission.USERS_UPDATE,
  SystemPermission.ROLES_VIEW, SystemPermission.ROLES_READ,
  SystemPermission.DEPARTMENTS_VIEW, SystemPermission.DEPARTMENTS_READ, SystemPermission.DEPARTMENTS_UPDATE,
  SystemPermission.ANNOUNCEMENTS_VIEW, SystemPermission.ANNOUNCEMENTS_CREATE, SystemPermission.ANNOUNCEMENTS_READ, SystemPermission.ANNOUNCEMENTS_UPDATE,
  SystemPermission.EVENTS_VIEW, SystemPermission.EVENTS_CREATE, SystemPermission.EVENTS_READ, SystemPermission.EVENTS_UPDATE,
  SystemPermission.TASKS_VIEW, SystemPermission.TASKS_CREATE, SystemPermission.TASKS_READ, SystemPermission.TASKS_UPDATE,
  SystemPermission.RECRUITMENT_VIEW, SystemPermission.RECRUITMENT_CREATE, SystemPermission.RECRUITMENT_READ, SystemPermission.RECRUITMENT_UPDATE,
  SystemPermission.PROJECTS_VIEW, SystemPermission.PROJECTS_CREATE, SystemPermission.PROJECTS_READ, SystemPermission.PROJECTS_UPDATE,
  SystemPermission.RESOURCES_VIEW, SystemPermission.RESOURCES_CREATE, SystemPermission.RESOURCES_READ, SystemPermission.RESOURCES_UPDATE,
  SystemPermission.BOARDS_VIEW, SystemPermission.BOARDS_READ,
  SystemPermission.INVENTORY_VIEW, SystemPermission.INVENTORY_CREATE, SystemPermission.INVENTORY_READ, SystemPermission.INVENTORY_UPDATE,
  SystemPermission.PLANS_VIEW, SystemPermission.PLANS_CREATE, SystemPermission.PLANS_READ, SystemPermission.PLANS_UPDATE,
  SystemPermission.FILES_UPLOAD, SystemPermission.FILES_VIEW, SystemPermission.FILES_DELETE,
  SystemPermission.DEBTS_VIEW, SystemPermission.DEBTS_CREATE, SystemPermission.DEBTS_READ, SystemPermission.DEBTS_UPDATE, SystemPermission.DEBTS_DELETE,
  SystemPermission.INCIDENTS_VIEW, SystemPermission.INCIDENTS_CREATE, SystemPermission.INCIDENTS_READ, SystemPermission.INCIDENTS_UPDATE,
  SystemPermission.AUDITS_READ,
]

const USER_PERMISSIONS: SystemPermission[] = [
  SystemPermission.ANNOUNCEMENTS_VIEW, SystemPermission.USERS_READ, SystemPermission.DEPARTMENTS_READ,
  SystemPermission.ANNOUNCEMENTS_READ, SystemPermission.EVENTS_VIEW, SystemPermission.EVENTS_READ,
  SystemPermission.TASKS_VIEW, SystemPermission.TASKS_READ, SystemPermission.TASKS_CREATE,
  SystemPermission.RECRUITMENT_VIEW, SystemPermission.RECRUITMENT_READ,
  SystemPermission.PROJECTS_VIEW, SystemPermission.PROJECTS_READ,
  SystemPermission.RESOURCES_VIEW, SystemPermission.RESOURCES_READ,
  SystemPermission.BOARDS_VIEW, SystemPermission.BOARDS_READ,
  SystemPermission.INVENTORY_VIEW, SystemPermission.INVENTORY_READ,
  SystemPermission.PLANS_VIEW, SystemPermission.PLANS_CREATE, SystemPermission.PLANS_READ,
  SystemPermission.FILES_UPLOAD, SystemPermission.FILES_VIEW,
  SystemPermission.DEBTS_VIEW, SystemPermission.DEBTS_READ,
]

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting production seed...')

  // ── Departments ──────────────────────────────────────────────────────────

  const deptData = [
    { name: 'Administration',   description: 'Administração e gestão geral do NEI' },
    { name: 'Human Resources',  description: 'Recrutamento, pessoas e cultura' },
    { name: 'Finance',          description: 'Gestão financeira e contabilidade' },
    { name: 'IT',               description: 'Tecnologia de informação e infraestrutura' },
    { name: 'Marketing',        description: 'Comunicação, marketing e redes sociais' },
    { name: 'Events',           description: 'Organização e logística de eventos' },
    { name: 'Academic Affairs', description: 'Apoio académico e relações institucionais' },
  ]

  const depts: any[] = []
  for (const d of deptData) {
    const dept = await prisma.department.upsert({
      where: { name: d.name },
      update: {},
      create: d,
    })
    depts.push(dept)
  }

  const [adminDept, hrDept, financeDept, itDept, marketingDept, eventsDept, academicDept] = depts

  // ── Roles ─────────────────────────────────────────────────────────────────

  const [adminRole, coordinatorRole, userRole] = await Promise.all([
    prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: { permissions: ALL_PERMISSIONS as any },
      create: { name: 'ADMIN', description: 'Administrator with full access', permissions: ALL_PERMISSIONS as any },
    }),
    prisma.role.upsert({
      where: { name: 'COORDINATOR' },
      update: { permissions: COORDINATOR_PERMISSIONS as any },
      create: { name: 'COORDINATOR', description: 'Department coordinator', permissions: COORDINATOR_PERMISSIONS as any },
    }),
    prisma.role.upsert({
      where: { name: 'USER' },
      update: { permissions: USER_PERMISSIONS as any },
      create: { name: 'USER', description: 'Regular user with limited access', permissions: USER_PERMISSIONS as any },
    }),
  ])

  // ── Users ─────────────────────────────────────────────────────────────────

  const hashedAdmin = await bcrypt.hash('admin123', 10)
  const hashedCoord = await bcrypt.hash('coord123', 10)
  const hashedTest  = await bcrypt.hash('test123', 10)

  const usersData = [
    { email: 'admin@orbit.com',       name: 'Administrator',       password: hashedAdmin, dept: adminDept,    role: adminRole,       status: UserStatus.ACTIVE },
    { email: 'coordinator@orbit.com', name: 'João Coordenador',    password: hashedCoord, dept: hrDept,       role: coordinatorRole, status: UserStatus.ACTIVE },
    { email: 'ricardo@orbit.com',     name: 'Ricardo Silva',       password: hashedTest,  dept: hrDept,       role: userRole,        status: UserStatus.ACTIVE },
    { email: 'maria@orbit.com',       name: 'Maria Santos',        password: hashedTest,  dept: financeDept,  role: userRole,        status: UserStatus.ACTIVE },
    { email: 'joao@orbit.com',        name: 'João Costa',          password: hashedTest,  dept: itDept,       role: userRole,        status: UserStatus.ACTIVE },
    { email: 'ana@orbit.com',         name: 'Ana Oliveira',        password: hashedTest,  dept: marketingDept, role: userRole,       status: UserStatus.ACTIVE },
    { email: 'carlos@orbit.com',      name: 'Carlos Ferreira',     password: hashedTest,  dept: hrDept,       role: userRole,        status: UserStatus.INACTIVE },
    { email: 'sofia@orbit.com',       name: 'Sofia Rodrigues',     password: hashedTest,  dept: eventsDept,   role: coordinatorRole, status: UserStatus.ACTIVE },
    { email: 'miguel@orbit.com',      name: 'Miguel Pereira',      password: hashedTest,  dept: itDept,       role: userRole,        status: UserStatus.ACTIVE },
    { email: 'ines@orbit.com',        name: 'Inês Marques',        password: hashedTest,  dept: academicDept, role: userRole,        status: UserStatus.ACTIVE },
    { email: 'tiago@orbit.com',       name: 'Tiago Almeida',       password: hashedTest,  dept: marketingDept, role: userRole,       status: UserStatus.ACTIVE },
    { email: 'beatriz@orbit.com',     name: 'Beatriz Carvalho',    password: hashedTest,  dept: financeDept,  role: userRole,        status: UserStatus.ACTIVE },
    { email: 'rui@orbit.com',         name: 'Rui Mendes',          password: hashedTest,  dept: adminDept,    role: coordinatorRole, status: UserStatus.ACTIVE },
    { email: 'catarina@orbit.com',    name: 'Catarina Sousa',      password: hashedTest,  dept: eventsDept,   role: userRole,        status: UserStatus.ACTIVE },
    { email: 'nuno@orbit.com',        name: 'Nuno Fonseca',        password: hashedTest,  dept: itDept,       role: userRole,        status: UserStatus.SUSPENDED },
  ]

  const users: any[] = []
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        password: u.password,
        status: u.status,
        departmentId: u.dept.id,
      },
    })
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: u.role.id } },
      update: {},
      create: { userId: user.id, roleId: u.role.id },
    })
    users.push(user)
  }

  const [admin, coordinator, ricardo, maria, joao, ana, carlos, sofia, miguel, ines, tiago, beatriz, rui, catarina, nuno] = users

  // ── Boards ────────────────────────────────────────────────────────────────

  const boardsData = [
    { name: 'General Board',     description: 'Tarefas gerais do NEI', depts: [adminDept, hrDept] },
    { name: 'IT Sprint Board',   description: 'Sprint de desenvolvimento IT', depts: [itDept] },
    { name: 'Marketing Ops',     description: 'Operações de marketing', depts: [marketingDept] },
    { name: 'Events Planning',   description: 'Planeamento de eventos', depts: [eventsDept] },
    { name: 'Finance Workflow',  description: 'Fluxo de trabalho financeiro', depts: [financeDept] },
  ]

  const boards: any[] = []
  for (const b of boardsData) {
    const board = await prisma.board.create({
      data: {
        name: b.name,
        description: b.description,
        boardDepartments: {
          create: b.depts.map((d) => ({ departmentId: d.id })),
        },
      },
    })
    boards.push(board)
  }

  const [generalBoard, itBoard, marketingBoard, eventsBoard, financeBoard] = boards

  // ── Projects ──────────────────────────────────────────────────────────────

  const projectsData = [
    {
      name: 'ORBIT Platform v2',
      description: 'Redesign e evolução da plataforma ORBIT para produção.',
      status: ProjectStatus.ACTIVE,
      deadline: daysFromNow(60),
      departmentId: itDept.id,
      members: [admin, joao, miguel, nuno],
    },
    {
      name: 'Recrutamento 2025/26',
      description: 'Processo de recrutamento de novos membros para o NEI.',
      status: ProjectStatus.ACTIVE,
      deadline: daysFromNow(45),
      departmentId: hrDept.id,
      members: [coordinator, ricardo, carlos, sofia],
    },
    {
      name: 'Semana Académica 2025',
      description: 'Organização da Semana Académica do ISEP 2025.',
      status: ProjectStatus.COMPLETED,
      deadline: daysAgo(30),
      departmentId: eventsDept.id,
      members: [sofia, catarina, ana, tiago],
    },
    {
      name: 'Redesign Visual NEI',
      description: 'Rebranding do NEI — novo logótipo, paleta e guidelines.',
      status: ProjectStatus.ON_HOLD,
      deadline: daysFromNow(120),
      departmentId: marketingDept.id,
      members: [ana, tiago],
    },
    {
      name: 'Auditoria Financeira Q2',
      description: 'Revisão e auditoria das contas do segundo trimestre.',
      status: ProjectStatus.COMPLETED,
      deadline: daysAgo(15),
      departmentId: financeDept.id,
      members: [maria, beatriz, rui],
    },
    {
      name: 'Workshop de Empreendedorismo',
      description: 'Organização de workshops para alunos de engenharia.',
      status: ProjectStatus.PLANNING,
      deadline: daysFromNow(90),
      departmentId: academicDept.id,
      members: [ines, coordinator],
    },
    {
      name: 'Portal Académico',
      description: 'Portal de apoio académico e recursos para alunos.',
      status: ProjectStatus.ACTIVE,
      deadline: daysFromNow(75),
      departmentId: academicDept.id,
      members: [ines, joao, miguel],
    },
    {
      name: 'Integração com Moodle',
      description: 'API de integração com a plataforma Moodle do ISEP.',
      status: ProjectStatus.CANCELLED,
      deadline: daysAgo(60),
      departmentId: itDept.id,
      members: [joao, nuno],
    },
  ]

  const projects: any[] = []
  for (const p of projectsData) {
    const project = await prisma.project.create({
      data: {
        name: p.name,
        description: p.description,
        status: p.status,
        deadline: p.deadline,
        departmentId: p.departmentId,
        projectMembers: {
          create: p.members.map((u) => ({ userId: u.id })),
        },
      },
    })
    projects.push(project)
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  const taskTemplates = [
    // ORBIT Platform tasks
    { title: 'Setup CI/CD pipeline', desc: 'Configurar GitHub Actions para build + deploy automático', priority: Priority.HIGH, status: TaskStatus.DONE, project: projects[0], board: itBoard, assignees: [joao, miguel], daysAgoCreated: 45 },
    { title: 'Implementar autenticação JWT', desc: 'Módulo de auth com refresh tokens', priority: Priority.URGENT, status: TaskStatus.DONE, project: projects[0], board: itBoard, assignees: [joao], daysAgoCreated: 40 },
    { title: 'Migração base de dados v2', desc: 'Migrar schema Prisma para nova versão', priority: Priority.HIGH, status: TaskStatus.DONE, project: projects[0], board: itBoard, assignees: [miguel, joao], daysAgoCreated: 35 },
    { title: 'Módulo de notificações real-time', desc: 'Implementar WebSocket para notificações', priority: Priority.MEDIUM, status: TaskStatus.IN_PROGRESS, project: projects[0], board: itBoard, assignees: [miguel], daysAgoCreated: 10 },
    { title: 'Dashboard de métricas', desc: 'Widgets com dados reais da API', priority: Priority.MEDIUM, status: TaskStatus.IN_PROGRESS, project: projects[0], board: itBoard, assignees: [joao, miguel], daysAgoCreated: 8 },
    { title: 'Testes E2E com Playwright', desc: 'Suite completa de testes end-to-end', priority: Priority.HIGH, status: TaskStatus.TODO, project: projects[0], board: itBoard, assignees: [joao], daysAgoCreated: 5, deadline: daysFromNow(14) },
    { title: 'Documentação da API', desc: 'Swagger completo para todos os endpoints', priority: Priority.LOW, status: TaskStatus.TODO, project: projects[0], board: itBoard, assignees: [miguel], daysAgoCreated: 3, deadline: daysFromNow(21) },
    { title: 'Optimização de queries lentas', desc: 'Indexação e cache de queries críticas', priority: Priority.HIGH, status: TaskStatus.BLOCKED, project: projects[0], board: itBoard, assignees: [joao], daysAgoCreated: 7 },

    // Recrutamento tasks
    { title: 'Definir perfis de recrutamento', desc: 'Levantar necessidades por departamento', priority: Priority.HIGH, status: TaskStatus.DONE, project: projects[1], board: generalBoard, assignees: [coordinator, ricardo], daysAgoCreated: 50 },
    { title: 'Criar formulário de candidatura', desc: 'Google Forms + integração ORBIT', priority: Priority.MEDIUM, status: TaskStatus.DONE, project: projects[1], board: generalBoard, assignees: [ricardo], daysAgoCreated: 45 },
    { title: 'Divulgar nas redes sociais', desc: 'Posts Instagram, LinkedIn e Moodle', priority: Priority.MEDIUM, status: TaskStatus.DONE, project: projects[1], board: marketingBoard, assignees: [ana, tiago], daysAgoCreated: 40 },
    { title: 'Triagem de candidaturas recebidas', desc: 'Análise e classificação inicial', priority: Priority.HIGH, status: TaskStatus.IN_PROGRESS, project: projects[1], board: generalBoard, assignees: [coordinator, sofia], daysAgoCreated: 15, deadline: daysFromNow(7) },
    { title: 'Agendar entrevistas', desc: 'Calendário e convocatórias para candidatos', priority: Priority.MEDIUM, status: TaskStatus.TODO, project: projects[1], board: generalBoard, assignees: [ricardo], daysAgoCreated: 5, deadline: daysFromNow(10) },
    { title: 'Apresentação aos candidatos', desc: 'Slide deck do NEI para entrevistas', priority: Priority.LOW, status: TaskStatus.TODO, project: projects[1], board: generalBoard, assignees: [sofia], daysAgoCreated: 3 },

    // Semana Académica tasks (completed)
    { title: 'Reservar auditório A', desc: 'Contactar serviços académicos ISEP', priority: Priority.HIGH, status: TaskStatus.DONE, project: projects[2], board: eventsBoard, assignees: [sofia], daysAgoCreated: 90 },
    { title: 'Contactar oradores', desc: 'Lista de 5 oradores externos + 3 internos', priority: Priority.HIGH, status: TaskStatus.DONE, project: projects[2], board: eventsBoard, assignees: [catarina, sofia], daysAgoCreated: 80 },
    { title: 'Gestão de patrocínios', desc: 'Parceiros e contratos de patrocínio', priority: Priority.MEDIUM, status: TaskStatus.DONE, project: projects[2], board: eventsBoard, assignees: [catarina], daysAgoCreated: 70 },
    { title: 'Material gráfico', desc: 'Cartazes, banners e posts redes sociais', priority: Priority.MEDIUM, status: TaskStatus.DONE, project: projects[2], board: marketingBoard, assignees: [ana], daysAgoCreated: 60 },
    { title: 'Relatório pós-evento', desc: 'Análise de participação e resultados', priority: Priority.LOW, status: TaskStatus.DONE, project: projects[2], board: eventsBoard, assignees: [sofia, catarina], daysAgoCreated: 32 },

    // Redesign Visual tasks
    { title: 'Benchmark de identidade visual', desc: 'Análise de marcas de associações académicas', priority: Priority.MEDIUM, status: TaskStatus.DONE, project: projects[3], board: marketingBoard, assignees: [ana], daysAgoCreated: 60 },
    { title: 'Proposta de novo logótipo', desc: 'Mínimo 3 conceitos para aprovação', priority: Priority.HIGH, status: TaskStatus.BLOCKED, project: projects[3], board: marketingBoard, assignees: [tiago, ana], daysAgoCreated: 30 },
    { title: 'Guidelines de brand', desc: 'Manual completo de identidade visual', priority: Priority.MEDIUM, status: TaskStatus.TODO, project: projects[3], board: marketingBoard, assignees: [tiago], daysAgoCreated: 10, deadline: daysFromNow(90) },

    // Auditoria Financeira tasks (completed)
    { title: 'Recolha de extractos bancários', desc: 'Jan-Jun 2025', priority: Priority.HIGH, status: TaskStatus.DONE, project: projects[4], board: financeBoard, assignees: [maria], daysAgoCreated: 45 },
    { title: 'Reconciliação de contas', desc: 'Verificação de lançamentos vs extractos', priority: Priority.HIGH, status: TaskStatus.DONE, project: projects[4], board: financeBoard, assignees: [beatriz, maria], daysAgoCreated: 35 },
    { title: 'Relatório de auditoria Q2', desc: 'Documento final para direcção', priority: Priority.MEDIUM, status: TaskStatus.DONE, project: projects[4], board: financeBoard, assignees: [rui], daysAgoCreated: 16 },

    // Workshop tasks
    { title: 'Definir programa do workshop', desc: 'Temas e estrutura das sessões', priority: Priority.HIGH, status: TaskStatus.IN_PROGRESS, project: projects[5], board: generalBoard, assignees: [ines, coordinator], daysAgoCreated: 20, deadline: daysFromNow(30) },
    { title: 'Contactar mentores', desc: 'Empreendedores e alumni ISEP', priority: Priority.MEDIUM, status: TaskStatus.TODO, project: projects[5], board: generalBoard, assignees: [ines], daysAgoCreated: 10, deadline: daysFromNow(45) },
    { title: 'Inscrições para o workshop', desc: 'Formulário e divulgação interna', priority: Priority.LOW, status: TaskStatus.TODO, project: projects[5], board: generalBoard, assignees: [coordinator], daysAgoCreated: 5, deadline: daysFromNow(60) },

    // Portal Académico tasks
    { title: 'Wireframes do portal', desc: 'Fluxo de navegação e UI', priority: Priority.HIGH, status: TaskStatus.DONE, project: projects[6], board: itBoard, assignees: [ines, joao], daysAgoCreated: 30 },
    { title: 'Backend do portal', desc: 'Endpoints de conteúdo académico', priority: Priority.HIGH, status: TaskStatus.IN_PROGRESS, project: projects[6], board: itBoard, assignees: [miguel, joao], daysAgoCreated: 15, deadline: daysFromNow(20) },
    { title: 'Frontend do portal', desc: 'Componentes React + integração API', priority: Priority.MEDIUM, status: TaskStatus.TODO, project: projects[6], board: itBoard, assignees: [joao], daysAgoCreated: 7, deadline: daysFromNow(35) },
    { title: 'Migração de conteúdo', desc: 'Importar recursos do portal antigo', priority: Priority.LOW, status: TaskStatus.TODO, project: projects[6], board: itBoard, assignees: [ines], daysAgoCreated: 3, deadline: daysFromNow(50) },

    // Board-only tasks (sem projecto)
    { title: 'Atualizar política de dados', desc: 'RGPD — revisão anual', priority: Priority.MEDIUM, status: TaskStatus.TODO, board: generalBoard, assignees: [rui], daysAgoCreated: 5, deadline: daysFromNow(30) },
    { title: 'Reunião mensal direcção', desc: 'Preparar agenda e atas', priority: Priority.LOW, status: TaskStatus.IN_PROGRESS, board: generalBoard, assignees: [admin], daysAgoCreated: 2 },
    { title: 'Backup infraestrutura', desc: 'Snapshot de todas as VMs', priority: Priority.HIGH, status: TaskStatus.TODO, board: itBoard, assignees: [miguel, nuno], daysAgoCreated: 1, deadline: daysFromNow(7) },
    { title: 'Actualizar certificado SSL', desc: 'Renovação automática via Let\'s Encrypt', priority: Priority.URGENT, status: TaskStatus.TODO, board: itBoard, assignees: [miguel], daysAgoCreated: 0, deadline: daysFromNow(3) },
    { title: 'Newsletter mensal', desc: 'Redigir e enviar newsletter de Maio', priority: Priority.MEDIUM, status: TaskStatus.IN_PROGRESS, board: marketingBoard, assignees: [tiago, ana], daysAgoCreated: 4, deadline: daysFromNow(5) },
    { title: 'Campanha Instagram verão', desc: 'Calendário editorial Junho-Agosto', priority: Priority.MEDIUM, status: TaskStatus.TODO, board: marketingBoard, assignees: [ana], daysAgoCreated: 2, deadline: daysFromNow(20) },
    { title: 'Controlo de inventário semestral', desc: 'Verificação física de todos os ativos', priority: Priority.LOW, status: TaskStatus.TODO, board: generalBoard, assignees: [rui, beatriz], daysAgoCreated: 1, deadline: daysFromNow(14) },
    { title: 'Preparar orçamento 2025/26', desc: 'Proposta de orçamento anual por departamento', priority: Priority.HIGH, status: TaskStatus.BLOCKED, board: financeBoard, assignees: [maria, beatriz], daysAgoCreated: 8, deadline: daysFromNow(21) },
    { title: 'Renovação contratos fornecedores', desc: 'Análise e renegociação de contratos', priority: Priority.MEDIUM, status: TaskStatus.TODO, board: financeBoard, assignees: [rui], daysAgoCreated: 6, deadline: daysFromNow(45) },
    { title: 'Check-in técnico mensal', desc: 'Revisão de tickets abertos e bugs críticos', priority: Priority.MEDIUM, status: TaskStatus.DONE, board: itBoard, assignees: [joao, miguel], daysAgoCreated: 14 },
  ]

  for (const t of taskTemplates) {
    await prisma.task.create({
      data: {
        title: t.title,
        description: t.desc,
        priority: t.priority,
        status: t.status,
        deadline: t.deadline ?? null,
        boardId: t.board?.id ?? null,
        projectId: t.project?.id ?? null,
        createdAt: daysAgo(t.daysAgoCreated ?? 0),
        taskAssignees: {
          create: (t.assignees ?? []).map((u) => ({ userId: u.id })),
        },
      },
    })
  }

  // ── Announcements / Feed ──────────────────────────────────────────────────

  const announcementsData = [
    { title: 'Bem-vindos ao ORBIT!', content: '<p>O ORBIT é a nova plataforma interna do NEI-ISEP. Aqui vão encontrar tudo: tarefas, eventos, documentos e muito mais. <strong>Bom trabalho a todos!</strong></p>', createdBy: admin, pinned: true, visibility: Visibility.PUBLIC, daysAgo: 180 },
    { title: 'Recrutamento 2025/26 aberto', content: '<p>Abrimos candidaturas para novos membros do NEI. Partilhem com amigos e colegas! As candidaturas fecham em 15 de Junho.</p>', createdBy: coordinator, pinned: true, visibility: Visibility.PUBLIC, daysAgo: 30 },
    { title: 'Reunião de direcção — Maio', content: '<p>Recordamos que a reunião mensal da direcção é dia <strong>28 de Maio às 18h00</strong> na sala B201. Presença obrigatória para coordenadores.</p>', createdBy: admin, pinned: false, visibility: Visibility.PUBLIC, daysAgo: 5 },
    { title: 'Novo servidor de desenvolvimento', content: '<p>O departamento de IT configurou um novo servidor de desenvolvimento. Credenciais no Bitwarden. Reportem problemas ao Miguel ou João.</p>', createdBy: joao, pinned: false, visibility: Visibility.DEPARTMENT, daysAgo: 20 },
    { title: 'Política de uso da sala NEI', content: '<p>Lembramos as regras de utilização da sala: reserva com 24h de antecedência, máximo 3h por reserva, limpeza obrigatória após uso.</p>', createdBy: rui, pinned: false, visibility: Visibility.PUBLIC, daysAgo: 45 },
    { title: 'Workshop de empreendedorismo confirmado', content: '<p>Confirmámos a data do workshop: <strong>15 de Julho</strong>. Inscrições abertas até 10 de Julho. Vagas limitadas a 40 participantes.</p>', createdBy: ines, pinned: false, visibility: Visibility.PUBLIC, daysAgo: 10 },
    { title: 'Semana Académica — Balanço', content: '<p>Foi um sucesso! 🎉 Tivemos mais de 400 participantes ao longo dos 3 dias. Obrigado a todos os que contribuíram. Relatório completo em breve.</p>', createdBy: sofia, pinned: false, visibility: Visibility.PUBLIC, daysAgo: 32 },
    { title: 'Novas diretrizes de brand', content: '<p>Até aprovação do novo logótipo, pedimos que usem os templates aprovados em 2024. Não usem versões não oficiais nas comunicações externas.</p>', createdBy: ana, pinned: false, visibility: Visibility.DEPARTMENT, daysAgo: 25 },
    { title: 'Manutenção programada — 1 Junho', content: '<p>No dia 1 de Junho das 02h00 às 06h00 haverá manutenção programada. O ORBIT estará indisponível durante este período.</p>', createdBy: miguel, pinned: false, visibility: Visibility.PUBLIC, daysAgo: 3 },
    { title: 'Auditoria Q2 concluída', content: '<p>A auditoria financeira do segundo trimestre foi concluída com sucesso. Resultado: <strong>superávit de 1.240€</strong>. Parabéns à equipa de finanças!</p>', createdBy: rui, pinned: false, visibility: Visibility.DEPARTMENT, daysAgo: 14 },
    { title: 'Prazo entrega relatórios — 30 Junho', content: '<p>Todos os departamentos devem submeter os seus relatórios de actividade até 30 de Junho. Usem o módulo de Planos no ORBIT.</p>', createdBy: admin, pinned: false, visibility: Visibility.PUBLIC, daysAgo: 7 },
    { title: 'Integração Moodle cancelada', content: '<p>Após análise técnica e reunião com os serviços académicos, a integração com o Moodle foi suspensa por limitações de acesso à API. Reavaliaremos em 2026.</p>', createdBy: joao, pinned: false, visibility: Visibility.DEPARTMENT, daysAgo: 60 },
    { title: 'Férias de Verão — escalonamento', content: '<p>Por favor preencham o formulário de férias de verão até 15 de Junho. Necessário garantir cobertura mínima em todos os departamentos.</p>', createdBy: coordinator, pinned: false, visibility: Visibility.PUBLIC, daysAgo: 8 },
    { title: 'Segurança — actualização de passwords', content: '<p>Por política de segurança, pedimos que todos actualizem as suas passwords no ORBIT. Passwords devem ter mínimo 12 caracteres.</p>', createdBy: admin, pinned: false, visibility: Visibility.PUBLIC, daysAgo: 15 },
    { title: 'Parabéns Inês — destaque do mês!', content: '<p>A Inês Marques foi distinguida como membro destaque de Maio pelo seu trabalho excepcional no Portal Académico. Parabéns! 🏆</p>', createdBy: admin, pinned: false, visibility: Visibility.PUBLIC, daysAgo: 2 },
  ]

  for (const a of announcementsData) {
    await prisma.announcement.create({
      data: {
        title: a.title,
        content: a.content,
        createdById: a.createdBy.id,
        pinned: a.pinned,
        visibility: a.visibility,
        type: 'ANNOUNCEMENT',
        createdAt: daysAgo(a.daysAgo),
        updatedAt: daysAgo(a.daysAgo),
      },
    })
  }

  // ── Events ────────────────────────────────────────────────────────────────

  const eventsData = [
    { title: 'Semana Académica ISEP 2025', desc: 'Maior evento anual do NEI — workshops, palestras e networking.', location: 'ISEP — Auditório Principal', start: daysAgo(32), end: daysAgo(29), visibility: Visibility.PUBLIC },
    { title: 'Reunião de Direcção — Maio', desc: 'Reunião mensal da direcção do NEI.', location: 'Sala B201, ISEP', start: daysAgo(5), end: daysAgo(5), visibility: Visibility.DEPARTMENT },
    { title: 'Workshop Figma para Iniciantes', desc: 'Aprende os fundamentos do Figma com membros do departamento de marketing.', location: 'Sala NEI, Edifício G', start: daysFromNow(5), end: daysFromNow(5), visibility: Visibility.PUBLIC },
    { title: 'Tech Talk: IA Generativa', desc: 'Palestra sobre LLMs e o futuro da IA generativa na engenharia.', location: 'Auditório B, ISEP', start: daysFromNow(12), end: daysFromNow(12), visibility: Visibility.PUBLIC },
    { title: 'Reunião de Direcção — Junho', desc: 'Revisão de actividades e planeamento do mês.', location: 'Sala B201, ISEP', start: daysFromNow(3), end: daysFromNow(3), visibility: Visibility.DEPARTMENT },
    { title: 'Torneio de Futsal NEI', desc: 'Torneio interno entre departamentos. Inscrições até 1 Junho.', location: 'Pavilhão ISEP', start: daysFromNow(18), end: daysFromNow(18), visibility: Visibility.PUBLIC },
    { title: 'Workshop de Empreendedorismo', desc: 'Sessão de 1 dia com mentores e alumni ISEP sobre criação de startups.', location: 'ISEP — Sala A301', start: daysFromNow(48), end: daysFromNow(48), visibility: Visibility.PUBLIC },
    { title: 'Hackathon NEI 2025', desc: '48 horas de desenvolvimento, com prémios para as melhores soluções.', location: 'Campus ISEP', start: daysFromNow(65), end: daysFromNow(63), visibility: Visibility.PUBLIC },
    { title: 'Jantar de Fim de Ano NEI', desc: 'Celebração anual com todos os membros do NEI.', location: 'Restaurante Central, Porto', start: daysFromNow(90), end: daysFromNow(90), visibility: Visibility.DEPARTMENT },
    { title: 'Palestra: Desenvolvimento Sustentável', desc: 'Como a engenharia pode contribuir para a sustentabilidade.', location: 'Auditório A, ISEP', start: daysFromNow(25), end: daysFromNow(25), visibility: Visibility.PUBLIC },
    { title: 'Sprint Review — Projecto ORBIT', desc: 'Revisão do sprint quinzenal do projecto ORBIT v2.', location: 'Online (Teams)', start: daysFromNow(7), end: daysFromNow(7), visibility: Visibility.DEPARTMENT },
    { title: 'Formação em Excel Avançado', desc: 'Workshop de Excel para gestão financeira.', location: 'Sala NEI, Edifício G', start: daysFromNow(30), end: daysFromNow(30), visibility: Visibility.PUBLIC },
  ]

  for (const e of eventsData) {
    await prisma.event.create({
      data: {
        title: e.title,
        description: e.desc,
        location: e.location,
        startDate: e.start,
        endDate: e.end,
        visibility: e.visibility,
        createdAt: daysAgo(randomBetween(5, 60)),
        updatedAt: daysAgo(randomBetween(0, 5)),
      },
    })
  }

  // ── Candidates ────────────────────────────────────────────────────────────

  const candidatesData = [
    { name: 'Alexandre Pinto',     email: 'alex.pinto@students.isep.ipp.pt',    course: 'Engenharia Informática', year: 2, stage: RecruitmentStage.HIRED,      notes: 'Excelente candidato, grande motivação.' },
    { name: 'Margarida Lopes',     email: 'mlopes@students.isep.ipp.pt',        course: 'Engenharia Electrotécnica', year: 1, stage: RecruitmentStage.OFFER,   notes: 'Aguarda confirmação de aceite.' },
    { name: 'Bruno Tavares',       email: 'btavares@students.isep.ipp.pt',      course: 'Engenharia Informática', year: 3, stage: RecruitmentStage.INTERVIEW,   notes: 'Entrevista marcada para 28/05.' },
    { name: 'Leonor Azevedo',      email: 'lazevedo@students.isep.ipp.pt',      course: 'Engenharia Biomédica', year: 2, stage: RecruitmentStage.INTERVIEW,     notes: 'Muito interesse em eventos.' },
    { name: 'Filipe Cunha',        email: 'fcunha@students.isep.ipp.pt',        course: 'Engenharia Civil', year: 1, stage: RecruitmentStage.SCREENING,        notes: 'CV analisado, aguarda triagem.' },
    { name: 'Diana Ferreira',      email: 'dferreira@students.isep.ipp.pt',     course: 'Engenharia Química', year: 2, stage: RecruitmentStage.SCREENING,       notes: 'Interessada em marketing.' },
    { name: 'Pedro Monteiro',      email: 'pmonteiro@students.isep.ipp.pt',     course: 'Engenharia Informática', year: 2, stage: RecruitmentStage.RECEIVED,    notes: 'Candidatura recebida recentemente.' },
    { name: 'Raquel Vieira',       email: 'rvieira@students.isep.ipp.pt',       course: 'Engenharia Ambiental', year: 3, stage: RecruitmentStage.RECEIVED,      notes: '' },
    { name: 'Gonçalo Barbosa',     email: 'gbarbosa@students.isep.ipp.pt',      course: 'Engenharia Mecânica', year: 2, stage: RecruitmentStage.REJECTED,       notes: 'Não cumpriu critérios mínimos de disponibilidade.' },
    { name: 'Marta Coelho',        email: 'mcoelho@students.isep.ipp.pt',       course: 'Engenharia Informática', year: 1, stage: RecruitmentStage.HIRED,       notes: 'Excelente! Integrada no IT.' },
    { name: 'Luís Cardoso',        email: 'lcardoso@students.isep.ipp.pt',      course: 'Engenharia de Materiais', year: 3, stage: RecruitmentStage.REJECTED,   notes: 'Conflito de disponibilidade.' },
    { name: 'Andreia Neves',       email: 'aneves@students.isep.ipp.pt',        course: 'Engenharia Informática', year: 2, stage: RecruitmentStage.OFFER,       notes: 'Proposta enviada.' },
    { name: 'Henrique Santos',     email: 'hsantos@students.isep.ipp.pt',       course: 'Engenharia de Sistemas', year: 1, stage: RecruitmentStage.INTERVIEW,   notes: '' },
    { name: 'Camila Antunes',      email: 'cantunes@students.isep.ipp.pt',      course: 'Engenharia Industrial', year: 2, stage: RecruitmentStage.SCREENING,    notes: 'Interesse em finanças.' },
    { name: 'Rodrigo Lima',        email: 'rlima@students.isep.ipp.pt',         course: 'Engenharia Informática', year: 3, stage: RecruitmentStage.RECEIVED,    notes: '' },
    { name: 'Francisca Gomes',     email: 'fgomes@students.isep.ipp.pt',        course: 'Engenharia Química', year: 1, stage: RecruitmentStage.RECEIVED,        notes: '' },
    { name: 'Tomás Alves',         email: 'talves@students.isep.ipp.pt',        course: 'Engenharia Electrotécnica', year: 2, stage: RecruitmentStage.HIRED,    notes: 'Integrado no departamento de IT.' },
    { name: 'Carolina Brito',      email: 'cbrito@students.isep.ipp.pt',        course: 'Engenharia Biomédica', year: 3, stage: RecruitmentStage.INTERVIEW,     notes: 'Interesse em eventos e marketing.' },
    { name: 'Eduardo Nogueira',    email: 'enogueira@students.isep.ipp.pt',     course: 'Engenharia de Redes', year: 1, stage: RecruitmentStage.RECEIVED,       notes: '' },
    { name: 'Patrícia Faria',      email: 'pfaria@students.isep.ipp.pt',        course: 'Engenharia Informática', year: 2, stage: RecruitmentStage.SCREENING,   notes: 'Candidatura forte.' },
  ]

  const candidateRecords: any[] = []
  for (const c of candidatesData) {
    const departmentChoices = depts
      .filter(() => Math.random() > 0.3)
      .slice(0, randomBetween(1, 4))
      .map((d, i) => ({ departmentId: d.id, priority: i + 1 }));
    const cand = await prisma.candidate.create({
      data: {
        name: c.name,
        email: c.email,
        course: c.course,
        year: c.year,
        stage: c.stage,
        notes: c.notes,
        createdAt: daysAgo(randomBetween(1, 30)),
        departmentChoices: departmentChoices.length
          ? { create: departmentChoices }
          : undefined,
      },
    })
    candidateRecords.push(cand)
  }

  // Add comments to some candidates
  const commentData = [
    { candidate: candidateRecords[0], user: coordinator, content: 'Candidato muito promissor. Recomendo avançar imediatamente.', daysAgo: 25 },
    { candidate: candidateRecords[0], user: sofia, content: 'Concordo, boa comunicação e iniciativa.', daysAgo: 24 },
    { candidate: candidateRecords[2], user: coordinator, content: 'Entrevista correu bem. Bom conhecimento técnico.', daysAgo: 10 },
    { candidate: candidateRecords[3], user: sofia, content: 'Muito entusiasmada com eventos. Boa energia.', daysAgo: 8 },
    { candidate: candidateRecords[9], user: joao, content: 'Marta mostrou excelentes skills de programação no teste técnico.', daysAgo: 15 },
    { candidate: candidateRecords[1], user: coordinator, content: 'Proposta enviada a 20/05. À espera de resposta.', daysAgo: 7 },
    { candidate: candidateRecords[8], user: coordinator, content: 'Não consegue garantir disponibilidade mínima de 8h/semana.', daysAgo: 12 },
    { candidate: candidateRecords[11], user: coordinator, content: 'Andreia tem perfil excelente para o departamento de marketing.', daysAgo: 5 },
  ]

  for (const c of commentData) {
    await prisma.recruitmentComment.create({
      data: {
        candidateId: c.candidate.id,
        createdById: c.user.id,
        content: c.content,
        createdAt: daysAgo(c.daysAgo),
      },
    })
  }

  // ── Resources (Documents) ─────────────────────────────────────────────────

  const resourcesData = [
    { title: 'Estatutos do NEI-ISEP', url: 'https://nei.isep.ipp.pt/estatutos.pdf', category: 'Legal', desc: 'Documento oficial com os estatutos da associação.', visibility: Visibility.PUBLIC },
    { title: 'Manual de Identidade Visual', url: 'https://nei.isep.ipp.pt/brand-guide.pdf', category: 'Marketing', desc: 'Guidelines de marca, logótipos e paletas de cor.', visibility: Visibility.PUBLIC },
    { title: 'Modelo de Proposta de Patrocínio', url: 'https://nei.isep.ipp.pt/patrocinio-template.docx', category: 'Templates', desc: 'Template para propostas de patrocínio a empresas.', visibility: Visibility.DEPARTMENT },
    { title: 'Regulamento de Uso da Sala NEI', url: 'https://nei.isep.ipp.pt/sala-regulamento.pdf', category: 'Interno', desc: 'Regras e procedimentos para reserva e uso da sala.', visibility: Visibility.PUBLIC },
    { title: 'Plano de Actividades 2024/25', url: 'https://nei.isep.ipp.pt/plano-actividades-2425.pdf', category: 'Planeamento', desc: 'Plano anual de actividades aprovado em assembleia.', visibility: Visibility.PUBLIC },
    { title: 'Relatório Semana Académica 2024', url: 'https://nei.isep.ipp.pt/sa2024-relatorio.pdf', category: 'Relatórios', desc: 'Balanço completo da Semana Académica 2024.', visibility: Visibility.PUBLIC },
    { title: 'Tutorial Git para Iniciantes', url: 'https://nei.isep.ipp.pt/git-tutorial.pdf', category: 'IT', desc: 'Guia prático de Git para novos membros do IT.', visibility: Visibility.PUBLIC },
    { title: 'Modelo de Ata de Reunião', url: 'https://nei.isep.ipp.pt/ata-template.docx', category: 'Templates', desc: 'Template standard para atas de reunião.', visibility: Visibility.DEPARTMENT },
    { title: 'Política de Privacidade RGPD', url: 'https://nei.isep.ipp.pt/rgpd.pdf', category: 'Legal', desc: 'Política de privacidade e protecção de dados.', visibility: Visibility.PUBLIC },
    { title: 'Guia de Integração de Novos Membros', url: 'https://nei.isep.ipp.pt/onboarding.pdf', category: 'RH', desc: 'Tudo o que precisas de saber nos primeiros 30 dias.', visibility: Visibility.PUBLIC },
    { title: 'Checklist Organização de Eventos', url: 'https://nei.isep.ipp.pt/eventos-checklist.xlsx', category: 'Eventos', desc: 'Checklist completa para organização de eventos.', visibility: Visibility.DEPARTMENT },
    { title: 'Relatório Financeiro 2024', url: 'https://nei.isep.ipp.pt/financeiro-2024.pdf', category: 'Financeiro', desc: 'Relatório de contas do ano 2024.', visibility: Visibility.DEPARTMENT },
  ]

  for (const r of resourcesData) {
    await prisma.resource.create({
      data: {
        title: r.title,
        url: r.url,
        category: r.category,
        description: r.desc,
        visibility: r.visibility,
        createdAt: daysAgo(randomBetween(10, 180)),
      },
    })
  }

  // ── Inventory ────────────────────────────────────────────────────────────

  const inventoryData = [
    { name: 'MacBook Pro 14" M3', desc: 'Portátil principal do departamento IT', value: '2499.00', qty: 2, dept: itDept, purchasedBy: admin, purchasedDate: daysAgo(200), warrantyDate: daysFromNow(800) },
    { name: 'Monitor LG UltraWide 34"', desc: 'Monitor para estação de trabalho', value: '549.00', qty: 3, dept: itDept, purchasedBy: admin, purchasedDate: daysAgo(300), warrantyDate: daysFromNow(700) },
    { name: 'Projetor Epson EB-S41', desc: 'Projetor para apresentações na sala NEI', value: '380.00', qty: 1, dept: adminDept, purchasedBy: rui, purchasedDate: daysAgo(500), warrantyDate: daysFromNow(100) },
    { name: 'Mesa de Reunião (8 lugares)', desc: 'Mesa principal da sala NEI', value: '890.00', qty: 1, dept: adminDept, purchasedBy: admin, purchasedDate: daysAgo(730), warrantyDate: null },
    { name: 'Cadeiras de Escritório Ergonómicas', desc: 'Cadeiras reguláveis para secretárias', value: '245.00', qty: 6, dept: adminDept, purchasedBy: rui, purchasedDate: daysAgo(400), warrantyDate: daysAgo(10) },
    { name: 'HP LaserJet Pro MFP', desc: 'Impressora multifunções da sala NEI', value: '320.00', qty: 1, dept: adminDept, purchasedBy: admin, purchasedDate: daysAgo(600), warrantyDate: daysAgo(30) },
    { name: 'Switch de Rede 24 portas', desc: 'Cisco SG350-28 gerido', value: '680.00', qty: 1, dept: itDept, purchasedBy: joao, purchasedDate: daysAgo(150), warrantyDate: daysFromNow(1300) },
    { name: 'UPS APC 1500VA', desc: 'Unidade de energia ininterrupta para servidores', value: '420.00', qty: 1, dept: itDept, purchasedBy: miguel, purchasedDate: daysAgo(90), warrantyDate: daysFromNow(1000) },
    { name: 'Microfone de Mesa Rode NT-USB', desc: 'Microfone para podcasts e reuniões online', value: '169.00', qty: 2, dept: marketingDept, purchasedBy: ana, purchasedDate: daysAgo(250), warrantyDate: daysFromNow(480) },
    { name: 'Canon EOS R50 + Lente 18-45mm', desc: 'Câmara para eventos e marketing', value: '849.00', qty: 1, dept: marketingDept, purchasedBy: ana, purchasedDate: daysAgo(180), warrantyDate: daysFromNow(550) },
    { name: 'iPad Pro 11" Wi-Fi 256GB', desc: 'Tablet para registo no local de eventos', value: '999.00', qty: 2, dept: eventsDept, purchasedBy: sofia, purchasedDate: daysAgo(120), warrantyDate: daysFromNow(760) },
    { name: 'Servidor Dell PowerEdge T40', desc: 'Servidor de produção local', value: '1200.00', qty: 1, dept: itDept, purchasedBy: joao, purchasedDate: daysAgo(365), warrantyDate: daysFromNow(365) },
    { name: 'Leitor de Cartões RFID', desc: 'Controlo de acesso à sala NEI', value: '89.00', qty: 1, dept: adminDept, purchasedBy: rui, purchasedDate: daysAgo(200), warrantyDate: daysFromNow(200) },
    { name: 'Disco Externo Seagate 2TB', desc: 'Backup de ficheiros e projectos', value: '75.00', qty: 3, dept: itDept, purchasedBy: miguel, purchasedDate: daysAgo(60), warrantyDate: daysFromNow(1000) },
    { name: 'Tripé Manfrotto 190X', desc: 'Tripé para gravações e eventos', value: '145.00', qty: 1, dept: marketingDept, purchasedBy: tiago, purchasedDate: daysAgo(90), warrantyDate: daysFromNow(900) },
  ]

  for (const item of inventoryData) {
    await prisma.inventoryItem.create({
      data: {
        name: item.name,
        description: item.desc,
        value: item.value as any,
        quantity: item.qty,
        departmentId: item.dept.id,
        purchasedById: item.purchasedBy.id,
        purchaseDate: item.purchasedDate,
        warrantyDate: item.warrantyDate,
        createdAt: item.purchasedDate,
      },
    })
  }

  // ── Plans ────────────────────────────────────────────────────────────────

  const plansData = [
    { name: 'Plano Semana Académica 2025', desc: 'Orçamento e programa completo da SA2025.', status: PlanStatus.APPROVED, dept: eventsDept, createdBy: sofia, approvedBy: admin, daysAgoCreated: 90, daysAgoApproved: 75, deadline: daysAgo(28) },
    { name: 'Proposta Campanha Marketing Q2', desc: 'Campanha nas redes sociais para o 2º trimestre.', status: PlanStatus.APPROVED, dept: marketingDept, createdBy: ana, approvedBy: coordinator, daysAgoCreated: 60, daysAgoApproved: 55, deadline: daysAgo(15) },
    { name: 'Plano Recrutamento 2025/26', desc: 'Processo e calendarização do recrutamento de novos membros.', status: PlanStatus.APPROVED, dept: hrDept, createdBy: coordinator, approvedBy: admin, daysAgoCreated: 45, daysAgoApproved: 40, deadline: daysFromNow(30) },
    { name: 'Proposta Workshop Empreendedorismo', desc: 'Plano logístico e orçamento do workshop de Julho.', status: PlanStatus.PENDING, dept: academicDept, createdBy: ines, daysAgoCreated: 15, deadline: daysFromNow(48) },
    { name: 'Renovação Equipamento IT', desc: 'Proposta de renovação de portáteis e monitores.', status: PlanStatus.PENDING, dept: itDept, createdBy: miguel, daysAgoCreated: 10, deadline: daysFromNow(21) },
    { name: 'Orçamento Hackathon 2025', desc: 'Proposta de orçamento para o Hackathon NEI 2025.', status: PlanStatus.PENDING, dept: eventsDept, createdBy: catarina, daysAgoCreated: 5, deadline: daysFromNow(60) },
    { name: 'Plano de Marketing Verão', desc: 'Estratégia de comunicação para os meses de Verão.', status: PlanStatus.REJECTED, dept: marketingDept, createdBy: tiago, daysAgoCreated: 30, rejectionNote: 'Orçamento excessivo. Rever valores e resubmeter.', daysAgoRejected: 25 },
    { name: 'Proposta Integração Moodle', desc: 'Análise técnica e custos da integração com Moodle.', status: PlanStatus.REJECTED, dept: itDept, createdBy: joao, daysAgoCreated: 70, rejectionNote: 'API do Moodle não disponível para acesso externo. Projecto cancelado.', daysAgoRejected: 60 },
    { name: 'Plano de Actividades 2025/26', desc: 'Plano anual de actividades para o ano lectivo 2025/26.', status: PlanStatus.PENDING, dept: adminDept, createdBy: rui, daysAgoCreated: 3, deadline: daysFromNow(90) },
    { name: 'Relatório de Actividades 2024/25', desc: 'Relatório anual de todas as actividades desenvolvidas.', status: PlanStatus.APPROVED, dept: adminDept, createdBy: admin, approvedBy: admin, daysAgoCreated: 20, daysAgoApproved: 15, deadline: daysAgo(10) },
  ]

  for (const p of plansData) {
    await prisma.plan.create({
      data: {
        name: p.name,
        description: p.desc,
        status: p.status,
        departmentId: p.dept.id,
        createdById: p.createdBy.id,
        approvedById: p.approvedBy?.id ?? null,
        approvedAt: p.daysAgoApproved ? daysAgo(p.daysAgoApproved) : null,
        rejectionNote: (p as any).rejectionNote ?? null,
        deadline: p.deadline ?? null,
        createdAt: daysAgo(p.daysAgoCreated),
        updatedAt: p.daysAgoApproved ? daysAgo(p.daysAgoApproved) : (p as any).daysAgoRejected ? daysAgo((p as any).daysAgoRejected) : daysAgo(p.daysAgoCreated),
      },
    })
  }

  // ── Debts ─────────────────────────────────────────────────────────────────

  const debtsData = [
    { desc: 'Patrocínio Empresa A — Semana Académica', value: '2500.00', type: DebtType.INCOME, creditorName: 'TechCorp Lda', creditorContact: 'geral@techcorp.pt', receivingAccount: 'PT50 0035 0000 0001 2345 6789 0', createdBy: rui, daysAgo: 90, status: DebtStatus.COMPLETED },
    { desc: 'Patrocínio Empresa B — Semana Académica', value: '1000.00', type: DebtType.INCOME, creditorName: 'InnoSoft SA', creditorContact: 'financeiro@innosoft.pt', receivingAccount: 'PT50 0035 0000 0001 2345 6789 0', createdBy: rui, daysAgo: 88, status: DebtStatus.COMPLETED },
    { desc: 'Aluguer Auditório A — SA2025', value: '450.00', type: DebtType.OUTCOME, debtorName: 'Serviços Académicos ISEP', depositAccount: 'PT50 0035 0000 0002 9876 5432 1', createdBy: sofia, daysAgo: 85, status: DebtStatus.COMPLETED },
    { desc: 'Catering Almoço SA2025 — Dia 1', value: '380.00', type: DebtType.OUTCOME, debtorName: 'Restaurante Central', debtorContact: 'reservas@restaurante.pt', depositAccount: 'PT50 0035 0000 0002 9876 5432 1', createdBy: catarina, daysAgo: 33, status: DebtStatus.PENDING },
    { desc: 'Material gráfico — cartazes e banners', value: '220.00', type: DebtType.OUTCOME, debtorName: 'Print&Go Lda', depositAccount: 'PT50 0035 0000 0002 9876 5432 1', createdBy: ana, daysAgo: 40, status: DebtStatus.PENDING },
    { desc: 'Quotas membros — Março 2025', value: '340.00', type: DebtType.INCOME, receivingAccount: 'PT50 0035 0000 0001 2345 6789 0', createdBy: beatriz, daysAgo: 57, status: DebtStatus.COMPLETED },
    { desc: 'Quotas membros — Abril 2025', value: '340.00', type: DebtType.INCOME, receivingAccount: 'PT50 0035 0000 0001 2345 6789 0', createdBy: beatriz, daysAgo: 27, status: DebtStatus.PENDING },
    { desc: 'Quotas membros — Maio 2025', value: '320.00', type: DebtType.INCOME, receivingAccount: 'PT50 0035 0000 0001 2345 6789 0', createdBy: beatriz, daysAgo: 3, status: DebtStatus.PENDING },
    { desc: 'Software Adobe Creative Cloud — licenças', value: '599.88', type: DebtType.OUTCOME, debtorName: 'Adobe Systems', depositAccount: 'PT50 0035 0000 0002 9876 5432 1', createdBy: ana, daysAgo: 120, status: DebtStatus.COMPLETED },
    { desc: 'Hosting VPS — servidor produção (anual)', value: '180.00', type: DebtType.OUTCOME, debtorName: 'Hetzner Online GmbH', depositAccount: 'PT50 0035 0000 0002 9876 5432 1', createdBy: miguel, daysAgo: 200, status: DebtStatus.COMPLETED },
    { desc: 'Venda de merchandising — Semana Académica', value: '680.00', type: DebtType.INCOME, receivingAccount: 'PT50 0035 0000 0001 2345 6789 0', createdBy: catarina, daysAgo: 30, status: DebtStatus.COMPLETED },
    { desc: 'Reembolso oradores externos SA2025', value: '250.00', type: DebtType.OUTCOME, debtorName: 'Vários', depositAccount: 'PT50 0035 0000 0002 9876 5432 1', createdBy: sofia, daysAgo: 29, status: DebtStatus.PENDING },
    { desc: 'Domínio NEI 2025 (renovação)', value: '18.00', type: DebtType.OUTCOME, debtorName: 'NIC.PT', depositAccount: 'PT50 0035 0000 0002 9876 5432 1', createdBy: joao, daysAgo: 180, status: DebtStatus.COMPLETED },
    { desc: 'Subsídio ISEP — 1º semestre', value: '1500.00', type: DebtType.INCOME, creditorName: 'ISEP — Gabinete de Apoio ao Aluno', receivingAccount: 'PT50 0035 0000 0001 2345 6789 0', createdBy: rui, daysAgo: 150, status: DebtStatus.COMPLETED },
    { desc: 'Material de escritório Q1', value: '87.50', type: DebtType.OUTCOME, debtorName: 'Staples Portugal', depositAccount: 'PT50 0035 0000 0002 9876 5432 1', createdBy: beatriz, daysAgo: 90, status: DebtStatus.COMPLETED },
  ]

  for (const d of debtsData) {
    await prisma.debt.create({
      data: {
        description: d.desc,
        value: d.value as any,
        type: d.type,
        status: d.status,
        occurredAt: daysAgo(d.daysAgo),
        completedAt: d.status === DebtStatus.COMPLETED ? daysAgo(Math.max(d.daysAgo - 1, 0)) : null,
        debtorName: (d as any).debtorName ?? null,
        debtorContact: (d as any).debtorContact ?? null,
        creditorName: (d as any).creditorName ?? null,
        creditorContact: (d as any).creditorContact ?? null,
        receivingAccount: (d as any).receivingAccount ?? null,
        depositAccount: (d as any).depositAccount ?? null,
        fileKeys: [],
        createdById: d.createdBy.id,
        createdAt: daysAgo(d.daysAgo),
        updatedAt: daysAgo(d.daysAgo),
      },
    })
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  const notifData = [
    { user: joao, type: 'TASK_ASSIGNED', content: 'Foste atribuído à tarefa "Testes E2E com Playwright"', daysAgo: 5 },
    { user: miguel, type: 'TASK_ASSIGNED', content: 'Foste atribuído à tarefa "Módulo de notificações real-time"', daysAgo: 10 },
    { user: ines, type: 'PLAN_REVIEWED', content: 'O teu plano "Proposta Workshop Empreendedorismo" está em análise', daysAgo: 14 },
    { user: tiago, type: 'PLAN_REJECTED', content: 'O teu plano "Plano de Marketing Verão" foi rejeitado. Ver nota de rejeição.', daysAgo: 25 },
    { user: sofia, type: 'PLAN_APPROVED', content: 'O teu plano "Plano Semana Académica 2025" foi aprovado!', daysAgo: 75 },
    { user: coordinator, type: 'CANDIDATE_STAGE', content: 'Alexandre Pinto avançou para a fase HIRED', daysAgo: 3 },
    { user: ana, type: 'TASK_ASSIGNED', content: 'Foste atribuída à tarefa "Campanha Instagram verão"', daysAgo: 2 },
    { user: beatriz, type: 'TASK_ASSIGNED', content: 'Foste atribuída à tarefa "Preparar orçamento 2025/26"', daysAgo: 8 },
    { user: rui, type: 'ANNOUNCEMENT', content: 'Novo anúncio publicado: "Reunião de direcção — Maio"', daysAgo: 5 },
    { user: miguel, type: 'TASK_DEADLINE', content: 'A tarefa "Actualizar certificado SSL" tem prazo em 3 dias!', daysAgo: 0 },
  ]

  for (const n of notifData) {
    await prisma.notification.create({
      data: {
        targetUserId: n.user.id,
        type: n.type,
        content: n.content,
        read: Math.random() > 0.4,
        createdAt: daysAgo(n.daysAgo),
      },
    })
  }

  // ── UserSettings (defaults) ───────────────────────────────────────────────

  for (const user of users) {
    await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        darkMode: false,
        emailNotifications: true,
        inAppNotifications: true,
        language: 'pt',
      },
    })
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log('\n✅ Seed concluído com sucesso!')
  console.log('\n📊 Dados criados:')
  console.log(`   🏢 ${depts.length} departamentos`)
  console.log(`   👥 ${users.length} utilizadores`)
  console.log(`   📋 ${boardsData.length} boards`)
  console.log(`   🚀 ${projectsData.length} projectos`)
  console.log(`   ✅ ${taskTemplates.length} tarefas`)
  console.log(`   📣 ${announcementsData.length} anúncios`)
  console.log(`   📅 ${eventsData.length} eventos`)
  console.log(`   👤 ${candidatesData.length} candidatos`)
  console.log(`   📁 ${resourcesData.length} recursos`)
  console.log(`   📦 ${inventoryData.length} itens de inventário`)
  console.log(`   📄 ${plansData.length} planos`)
  console.log(`   💰 ${debtsData.length} registos financeiros`)
  console.log(`   🔔 ${notifData.length} notificações`)
  console.log('\n🔑 Contas de acesso:')
  console.log('   Admin:       admin@orbit.com       / admin123')
  console.log('   Coordinator: coordinator@orbit.com / coord123')
  console.log('   Users:       ricardo@orbit.com     / test123 (e outros)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
