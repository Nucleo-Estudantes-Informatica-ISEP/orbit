# ORBIT — Internal Operating System · NEI-ISEP

Sistema interno da **NEI-ISEP** (Núcleo de Estudantes de Informática do ISEP) que combina **ERP + HRM + Recrutamento + Gestão de Projetos + Inventário + Planos + Dívidas** numa plataforma web unificada.

[Gestão de acessos externos](docs/access-lifecycle.md): onboarding/offboarding com escolha entre respostas reais do Google Forms e registo manual independente no Sheets, aprovação da Presidência, conectores Discord/GitHub/Drive e execução manual de Figma/WhatsApp/email/Coda/Freedcamp. Usa usernames/emails normais, com resolução de IDs pelo Orbit e políticas editáveis. [Forms de exemplo separado](docs/forms-member-example.md). Configuração e ativação do executor são explícitas; não cria contas Orbit para membros.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | NestJS 11 · Prisma 6 · PostgreSQL 16 |
| Frontend | Next.js 16 · React 19 · Tailwind CSS 4 · shadcn/ui |
| Ficheiros | Armazenamento privado compatível com S3 |
| Auth | Access JWT (15 min) + Refresh Token opaco rotativo (30 dias) · bcrypt · RBAC por permissões |
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
JWT_SECRET=
REFRESH_TOKEN_SECRET=
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

### Compatibilidade de sessões

Os access tokens têm uma validade de 15 minutos. A API verifica a sessão e carrega as permissões atuais do membro em cada pedido autenticado. O frontend mantém o access token em memória e usa o cookie de refresh para retomar a sessão.

O refresh token opaco é válido por 30 dias e roda em cada utilização. Logout, alteração de credenciais e inativação revogam as sessões correspondentes. A atualização para este formato exige um novo login e novos links de reposição.

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

Configure chaves distintas em `SERVICE_BASE64_64_JWT` e `REFRESH_TOKEN_SECRET`, credenciais PostgreSQL separadas para a API e para o migrador, e um bucket privado num serviço S3 atualizado. Migre e verifique os objetos do volume antigo antes de atualizar o Compose de produção. Consulte o [guia de migração](docs/shared-data.md).

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

## Armazenamento de ficheiros

Ficheiros são armazenados num bucket privado compatível com S3. A API verifica as permissões do registo associado antes de servir um anexo.

- Upload: `POST /files/upload` (multipart, campo `file`, máx. 10MB)
- Download: `GET /files/:key` — o backend verifica o acesso e serve o ficheiro
- Eliminação: `DELETE /files/:key` com `FILES_DELETE`, após remover as referências ao ficheiro
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
- A API usa identidades restritas para a base de dados e para o bucket privado.
- O access JWT identifica o membro e a sessão. A API consulta o estado e as permissões atuais antes de autorizar cada pedido.
- Refresh tokens opacos ficam num cookie `HttpOnly`, `SameSite=Strict`; o servidor guarda apenas fingerprints HMAC-SHA-256, roda-os em cada utilização e revoga-os no logout e em alterações de password.
- A API limita pedidos de autenticação por instância. Configure `AUTH_TRUST_PROXY_HOPS` para a topologia garantida pelo proxy e aplique limites partilhados no ingress quando houver várias réplicas.

---

## Contribuição, testes e CI/CD

For shared PostgreSQL and MinIO deployments, use [`docker-compose.shared.yml`](./docker-compose.shared.yml) and follow the [shared-data migration guide](./docs/shared-data.md). Keep the existing Compose location until the data copy and cutover are verified.

CI uses a disposable MinIO image only as a compatibility fixture for the S3 client. Production requires a separately maintained storage endpoint.


Leia [`AGENTS.md`](./AGENTS.md) antes de alterar o repositório. Para correções, prefira TDD: reproduza primeiro o erro num teste focado, implemente a menor correção e refatore com a suite verde.

Cada PR para `main` instala com `npm ci` e tem de passar lint, typecheck, testes unitários/E2E, migrações numa base isolada, build, contrato OpenAPI, auditoria de dependências, imagens Docker não-root, validação do compose Coolify e Gitleaks. O merge não prova deploy: confirme no Coolify o SHA, a migração, `/health` e os fluxos alterados.
