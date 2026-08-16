# ORBIT — Internal Operating System · NEI-ISEP

Sistema interno da **NEI-ISEP** (Núcleo de Estudantes de Informática do ISEP) que combina **ERP + HRM + Recrutamento + Gestão de Projetos + Inventário + Planos + Dívidas** numa plataforma web unificada.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | NestJS 11 · Prisma 6 · PostgreSQL 16 |
| Frontend | Next.js 16 · React 19 · Tailwind CSS 4 · shadcn/ui |
| Ficheiros | MinIO (armazenamento interno) |
| Auth | Access JWT (15 min) + Refresh Token rotativo (7d) · bcrypt · RBAC por permissões |
| Drag & Drop | @dnd-kit |
| Editor de texto | Tiptap |

---

## Arranque rápido (Docker Compose — recomendado)

```bash
# 1. Clonar
git clone <repo> orbit
cd orbit

# 2. Iniciar tudo
docker compose up -d

# 3. Migrar a base de dados
docker compose exec api npx prisma migrate deploy

# 4. Popular com dados de desenvolvimento (opcional)
docker compose exec api npx prisma db seed
```

Abre **http://localhost:3090** no browser.

---

## Variáveis de ambiente

### Backend (`api/.env`)

```env
DATABASE_URL="postgresql://postgres:postgres@db:5432/orbit?schema=public"
JWT_SECRET="mude-isto-em-producao"
PORT=3000
CORS_ORIGIN="http://localhost:3090,http://localhost:3000"
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=orbit
```

### Frontend

A `NEXT_PUBLIC_API_URL` é definida no `docker-compose.yml` como `/api` — o Next.js faz proxy de `/api/*` para `http://api:3000/*` (comunicação interna Docker).

### CORS

A API lê `CORS_ORIGIN` (separado por vírgulas). Em desenvolvimento com Docker, aceita `http://localhost:3090` (frontend) e `http://localhost:3000` (acesso direto).

---

## Contas de teste (seed dev)

```bash
docker compose exec api npx prisma db seed
```

| Conta | Email | Password | Permissões |
|-------|-------|----------|-----------|
| Administrador | `admin@orbit.com` | `admin123` | Acesso total |
| Coordenador | `coordinator@orbit.com` | `coord123` | Leitura + criação/edição na maioria dos módulos |
| Utilizadores | `ricardo@orbit.com`, `maria@orbit.com`, `joao@orbit.com`, `ana@orbit.com` | `test123` | Leitura + submissão de planos |

> O seed usa `upsert` — é seguro re-executar para atualizar permissões.

---

## Produção

### Seed de produção

Cria apenas 1 departamento (NEI-ISEP), 1 role (ADMIN com todas as permissões) e 1 admin:

```bash
docker compose exec api npx prisma db seed -- --seed=prisma/seed.prod.ts
```

Configurável via variáveis de ambiente:

| Variável | Regra |
|----------|-------|
| `ADMIN_EMAIL` | Obrigatória; sem valor predefinido |
| `ADMIN_PASSWORD` | Obrigatória; mínimo 16 caracteres; nunca é escrita nos logs |
| `ADMIN_NAME` | Opcional; por omissão `Administrator` |

O seed falha antes de escrever na base se as credenciais explícitas estiverem ausentes ou fracas. Guarde `ADMIN_PASSWORD` apenas no gestor de segredos e rode o seed uma única vez quando o bootstrap for realmente necessário.

### Coolify

A produção usa `docker-compose.coolify.yml`. O serviço `migrator` executa `prisma migrate deploy` e tem de terminar com sucesso antes da API arrancar. A API corre separadamente como utilizador não-root e expõe `GET /health`; o frontend só fica pronto depois da API. Configure `SMTP_PASS` como segredo do Coolify — nunca no compose ou no Git.

---

## Comandos úteis

### Docker

```bash
# Iniciar tudo
docker compose up -d

# Logs
docker compose logs -f api
docker compose logs -f frontend

# Executar comando no container da API
docker compose exec api npx prisma studio

# Parar
docker compose down

# Parar e apagar dados
docker compose down -v
```

### Prisma

```bash
# Criar migração
docker compose exec api npx prisma migrate dev --name descricao

# Aplicar migrações
docker compose exec api npx prisma migrate deploy

# Regenerar cliente Prisma
docker compose exec api npx prisma generate

# Seed desenvolvimento
docker compose exec api npx prisma db seed

# Seed produção
docker compose exec api npx prisma db seed -- --seed=prisma/seed.prod.ts

# Reset completo (APAGA DADOS)
docker compose exec api npx prisma migrate reset
```

---

## Módulos

| Módulo | Rota | Descrição |
|--------|------|-----------|
| Dashboard | `/dashboard` | Visão geral com widgets |
| Anúncios | `/dashboard/announcements` | Feed com editor rich-text, comentários, pin |
| Eventos | `/dashboard/events` | Lista + vista de calendário |
| Recursos | `/dashboard/documents` | Biblioteca com upload de ficheiros |
| Projetos | `/dashboard/projects` | Gestão de projetos por departamento |
| Tarefas | `/dashboard/tasks` | Kanban com drag-and-drop |
| **Recrutamento** | `/dashboard/recruitment` | Pipeline Kanban com CV, preferências de departamento (1ª–4ª) |
| Notificações | `/dashboard/notifications` | Centro de notificações |
| Pessoas | `/dashboard/people` | Utilizadores, roles e departamentos |
| Inventário | `/dashboard/inventory` | Gestão de ativos com fotos |
| Planos | `/dashboard/plans` | Submissão e aprovação de planos |
| Dívidas | `/dashboard/debts` | Gestão de dívidas (receitas/despesas) |
| Definições | `/dashboard/settings` | Perfil, tema, notificações |

---

## Armazenamento de ficheiros (MinIO)

Ficheiros (fotos de inventário, CVs, documentos de planos, recursos) são armazenados no **MinIO** — compatível com S3, corre internamente sem portas expostas ao exterior.

- Upload: `POST /files/upload` (multipart, campo `file`, máx. 10MB)
- Download: `GET /files/:key` — o backend faz proxy
- O frontend acede sempre via `/api/files/<key>` (proxy)

---

## Estrutura

```
orbit/
├── api/                          # Backend NestJS
│   ├── prisma/
│   │   ├── schema.prisma         # Modelos da base de dados
│   │   ├── seed.ts               # Seed de desenvolvimento
│   │   ├── seed.prod.ts          # Seed de produção
│   │   └── migrations/           # Histórico de migrações
│   ├── src/
│   │   ├── auth/                 # JWT + Guards + RBAC
│   │   ├── recruitment/          # Pipeline de recrutamento
│   │   ├── files/                # MinIO proxy
│   │   ├── departments/          # Gestão de departamentos
│   │   └── ...                   # Restantes módulos
│   └── Dockerfile
├── frontend/                     # Frontend Next.js
│   ├── app/dashboard/            # Páginas da plataforma
│   ├── components/               # Componentes partilhados
│   ├── locales/                  # Traduções (pt, en)
│   └── Dockerfile
├── docker-compose.yml            # api + frontend + db + minio
└── README.md
```

---

## Notas de segurança

- Apenas a porta `3090` (frontend) está exposta publicamente no Docker.
- API, base de dados e MinIO comunicam exclusivamente pela rede interna Docker.
- O access JWT armazena permissões e identidade. O refresh recarrega o perfil/permissões atuais e roda os dois tokens; alterações deixam de exigir um login completo.

---

## Contribuição, testes e CI/CD

Leia [`AGENTS.md`](./AGENTS.md) antes de alterar o repositório. Para correções, prefira TDD: reproduza primeiro o erro num teste focado, implemente a menor correção e refatore com a suite verde.

Cada PR para `main` instala com `npm ci` e tem de passar lint, typecheck, testes unitários/E2E, migrações numa base isolada, build, contrato OpenAPI, auditoria de dependências, imagens Docker não-root, validação do compose Coolify e Gitleaks. O merge não prova deploy: confirme no Coolify o SHA, a migração, `/health` e os fluxos alterados.
