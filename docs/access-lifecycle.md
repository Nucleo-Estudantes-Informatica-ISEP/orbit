# Gestão de acessos externos

O Orbit coordena onboarding, offboarding, alterações parciais e transições Alumni em `/dashboard/access`. Cada processo guarda a pessoa-alvo e os dados necessários como snapshot. Os operadores são os `User` existentes; este fluxo não cria contas Orbit nem desativa contas, identidades AuthNEI, mailboxes, documentos ou repositórios.

## Recolha de dados: Google Forms → Google Sheets

Os membros respondem a um Google Forms. As respostas ficam no Sheets associado; o Orbit pesquisa essa fonte e copia apenas os dados necessários para o pedido escolhido. Não importa toda a folha para um diretório de membros. Nome/email do pedido têm de corresponder à resposta selecionada. A resposta é referenciada por hash dos seus valores e da origem: se mudar ou existir duplicada, o operador deve voltar a pesquisar.

| Dado normal da pessoa | Quando é necessário | Cabeçalho compatível |
| --- | --- | --- |
| Nome e email de contacto | Todos | `Nome e Apelido`, `E-Mail Pessoal` |
| Departamento e cargo | Todos; traduzidos para os identificadores internos pelo servidor | `Departamento`, `Cargo` |
| Username Discord | Para os cargos no servidor; não é o nome de apresentação | `ID Discord` pode manter o nome e passar a guardar o username; também aceita `Username Discord` |
| Username GitHub | Informática e Coordenação de qualquer departamento | `Username GitHub` |
| Email da conta Google | Drive Geral e pastas aprovadas de Direção/Presidência | `Email Google` |
| Número de telemóvel com indicativo | Grupos WhatsApp | `Nº Telemóvel` |
| Email Figma | Informática e Marketing, ou exceção aprovada | `Email Figma` |
| Email Coda | Relações Externas, ou exceção aprovada | `Email Coda` |
| Email Freedcamp | Marketing, ou exceção aprovada | `Email Freedcamp` |
| Email institucional existente/pretendido | Pedido explícito de gestão cPanel | `E-mail NEI` |

Não pedir IDs de utilizador, IDs de permissões, UUIDs, passwords, tokens ou códigos MFA. Data de nascimento, ano, email ISEP e LinkedIn não são necessários para gerir acessos. Podem manter-se como colunas do registo atual sem serem pedidos no exemplo de Forms nem copiados para os processos.

Os cabeçalhos atuais de `Membros` mantêm-se. `ACCESS_SHEETS_COLUMNS` permite títulos personalizados; aliases conhecidos também reconhecem a folha existente, novas contas e títulos repetidos em secções condicionais (usa o primeiro valor não vazio). A comparação de cabeçalhos, departamentos e cargos ignora espaços, maiúsculas e acentos. `ACCESS_SHEETS_DEPARTMENTS` converte rótulos como `Informática` no UUID de Infraestruturas; `ACCESS_SHEETS_POSITIONS` permite traduções adicionais dos cargos declarados. Estes rótulos não atribuem permissões de operador.

O intervalo é limitado e inclui cabeçalhos: `Membros!A1:L5000` para a fonte existente, ou `Membros!A1:Q5000` para o exemplo com cinco campos novos. Aumentar a última linha antes de a fonte ultrapassar esse limite. A pesquisa exige três caracteres, aceita nomes sem acentos e termos separados, e devolve até 25 resultados por página (`offset`). Só mostra pessoas do âmbito departamental do operador. Um coordenador de Infra não encontra uma pessoa registada como Direção no Sheets; ADMIN/SYS-ADMIN com `ACCESS_ALL_DEPARTMENTS` veem os cinco departamentos.

O modelo [Forms condicional](forms-member-example.md) e o [script de criação](examples/orbit-member-form.gs) criam apenas ficheiros novos na conta Google que os executar. Mantêm os 12 cabeçalhos originais e acrescentam cinco contas no fim. A normalização das respostas escreve apenas no `Membros` da cópia. Não alteram o Forms, Sheets ou configuração de produção originais.

O Orbit resolve usernames Discord/GitHub para IDs estáveis ao guardar o rascunho quando a conta já existe. A aprovação guarda esse principal. Uma conta Discord ainda fora do servidor mantém o username declarado e aguarda entrada; `retry` volta a pesquisar o username exato, nunca nomes de apresentação/apelidos. O conector confirma servidor, conta, hierarquia e estado antes/depois da alteração. GitHub confirma também o ID remoto. IDs numéricos históricos continuam compatíveis.

No Drive, indicar apenas o email Google: o conector encontra e valida internamente a permissão em concessões, consultas e revogações. O ID devolvido fica no resultado técnico para auditoria/retry; não é um campo do formulário. A comparação do email ignora maiúsculas/espaços exteriores. Pedidos antigos com ID explícito continuam a exigir correspondência com a conta e nunca são redirecionados silenciosamente para outro email. Alterar o email na UI substitui o principal e limpa contexto de verificação anterior.

Os dados do Forms são declarados pela pessoa. A confirmação técnica da conta e do resultado automático pertence ao Orbit; não se pede ao operador uma frase de verificação para desbloquear o executor. Isto não constitui prova de identidade civil. Serviços manuais são confirmados após execução com evidência atribuída ao operador.

## Aprovação e permissões

Na transição para Alumni, políticas sem restrição de cargos continuam a aplicar-se, tal como as políticas explícitas de Alumni. Um recurso é sugerido para concessão/manutenção quando pelo menos uma dessas políticas está ativa e corresponde aos departamentos do pedido; só é sugerido para revogação quando nenhuma política aplicável o mantém. A sobreposição com uma política restrita a membros não cancela esse acesso.

Em “Alterar acessos”, pedidos novos mantêm a ação Conceder e operações reutilizadas começam em Consultar. O username original fica no histórico; Drive reutiliza o email normal em todas as ações e mantém compatibilidade com IDs antigos. Repor predefinições preserva contas, justificações e seleções adicionais. A transição para Alumni exige um cargo de origem diferente de Alumni, validado na interface e na API.

O formulário de novo pedido separa **Pessoa → Contexto → Acessos**. Na primeira etapa, pesquisar e selecionar uma resposta do Forms/Sheets ou optar explicitamente por introdução manual com referência da origem. A pesquisa indica carregamento e ausência de resultados. Na segunda, confirmar tipo, departamentos, cargos e motivo; isto define o contexto do pedido, sem alterar a conta Orbit. Na terceira, os acessos das políticas são pré-selecionados e os restantes ficam em “Outros acessos”, com justificação obrigatória. Recursos sensíveis exigem igualmente justificação. A transição para Alumni acrescenta o contexto Alumni e sugere concessão dos seus recursos, com revogação dos anteriores.

Cada plataforma pede a identificação normal relevante: usernames Discord/GitHub, email Google, telefone WhatsApp e emails das teams/cPanel. Não existem campos de ID de permissão nem confirmação manual de identidade para executar integrações automáticas. A configuração inclui executorEnabled/dryRun para mostrar o modo efetivo, separado da capacidade automática do recurso.

Todas as rotas têm autenticação JWT e verificam no servidor o estado atual do operador e as suas permissões na base de dados. O departamento do JWT/cliente não é usado como prova de autorização.

| Permissão | Uso |
| --- | --- |
| `ACCESS_READ` | Configuração visível, processos, pesquisa e inventário parcial dentro do âmbito permitido; obrigatória em todas as ações |
| `ACCESS_CREATE` | Pesquisar respostas, preparar, submeter e cancelar pedidos próprios ainda não aprovados |
| `ACCESS_APPROVE` | Decidir pedidos; atribuir apenas à Presidência/substitutos formalmente autorizados |
| `ACCESS_EXECUTE` | Evidências manuais, retries e observações remotas |
| `ACCESS_MANAGE` | Recursos/políticas; exige também âmbito global |
| `ACCESS_ALL_DEPARTMENTS` | Âmbito global explícito; isoladamente não dá permissão de ação |

Sem âmbito global, todos os departamentos da pessoa no pedido têm de ser o departamento atual do operador. Um processo com vários departamentos exige operador global. Este limite refere-se às pessoas: o catálogo completo de serviços continua disponível a coordenadores. Recursos habitualmente usados noutro departamento podem ser selecionados em Outros acessos, com justificação e aprovação. Os departmentIds de recursos/políticas orientam as predefinições; não ocultam o catálogo nem autorizam gerir pessoas de outro departamento.

O processo passa por `DRAFT → PENDING_APPROVAL → APPROVED|REJECTED`. Só o autor submete/cancela, antes da decisão. A decisão e o snapshot completo são gravados na mesma transação, com controlo de versão para impedir decisões concorrentes. Dados e operações são imutáveis: correções exigem novo pedido. A aprovação cobre os recursos concretos; recursos sensíveis ou fora da predefinição exigem justificação individual. `OFFBOARD` não pode conceder acessos; Alumni exige `ALUMNI_TRANSITION` explícito. Antes de revogar, solicitante e Presidência devem confirmar se outra função/departamento ainda legitima o acesso.

Links administrativos/convites só aparecem na configuração para administradores e nos processos aprovados para executores autorizados. Não são expostos no preview, rascunhos ou histórico decidido. Histórico, evidências e snapshots preservam a atribuição ao operador. A organização deve definir retenção de dados pessoais e responsáveis por consultar/exportar o histórico; este módulo não presume um inventário completo de todos os membros.

## Catálogo e predefinições

Depois de aplicar a migração, executar a inicialização **uma vez**, e novamente apenas para acrescentar predefinições em falta:

```bash
cd api
npm run access:seed
```

Na imagem de produção: `node dist/prisma/seed.access.js`. O seed usa IDs determinísticos, não cria utilizadores e preserva recursos/políticas existentes (`upsert` sem updates). As políticas são editadas e versionadas na administração da app; alterações não modificam processos existentes. Recursos novos ficam visíveis; destinos ainda não configurados mantêm instruções manuais e não executam chamadas automáticas. A migração operacional corrige uma vez os recursos de stock: ativa os quatro passos em falta e a capacidade automática dos cargos/pastas já configurados, sem alterar políticas, recursos personalizados ou snapshots. Revisões posteriores continuam editáveis na BD.

Na primeira inicialização, instalações com configuração já recolhida podem definir `ACCESS_BOOTSTRAP_RESOURCES` e `ACCESS_BOOTSTRAP_ROLE_PERMISSIONS` antes de executar o seed. Exemplo sem credenciais nem convites privados:

```json
{"figma":{"remoteId":"TEAM_ID","enabled":true,"automatic":false},"drive-general":{"remoteId":"FOLDER_ID","enabled":true,"automatic":true}}
```

Chaves estáveis disponíveis incluem `discord-members`, `discord-board`, `discord-presidency`, `discord-coordinator`, `discord-co-coordinator`, `discord-alumni`, `discord-server-manager`, `discord:department:<uuid>`, `drive-general`, `drive-board`, `drive-presidency`, `github`, `figma`, `whatsapp-general` e os restantes identificadores definidos no seed. Cada patch aceita apenas `remoteId`, `containerId`, `adminUrl` HTTPS, `enabled` e `automatic`. Recursos/papéis são validados antes da aplicação transacional. O seed só aplica patches a recursos que acabou de criar e permissões de roles na primeira inicialização. Repeti-lo preserva edições feitas na app; alterações posteriores usam a administração versionada. Recursos sem destino configurado mantêm instruções manuais; o executor mantém a configuração independente `ACCESS_EXECUTOR_ENABLED=false`.

Uma configuração explícita de roles, como `{"COORDENADOR":["ACCESS_READ","ACCESS_CREATE","ACCESS_EXECUTE"]}`, substitui apenas permissões `ACCESS_*` desses roles e preserva todas as outras. Nesse modo não é aplicada a concessão predefinida de todas as permissões ao `ADMIN`. Na configuração confirmada desta instalação, `SYS-ADMIN` tem todas as seis permissões, incluindo `ACCESS_APPROVE`; os `ADMIN` da Presidência também podem aprovar. A regra de quatro olhos continua a impedir autoaprovação. Não são criados roles, contas ou novos vínculos de utilizador. O nome departamental `Infraestruturas Informáticas` é reconhecido para as predefinições de Informática.

Inclui Discord Members/departamento/cargos, Drive Geral/Direção/Presidência, GitHub para Informática ou Coordenação, Figma para Informática/Marketing, Coda para Relações Externas, Freedcamp para Marketing e grupos WhatsApp. Estas são recomendações editáveis. Qualquer coordenador pode solicitar qualquer serviço para alguém do próprio departamento como exceção justificada. server-manager e cPanel exigem seleção explícita e justificação sensível; não são predefinições implícitas. Bots, roles geridas e @everyone não podem ser atribuídos.

Figma, Coda e Freedcamp são teams com convite manual: abrir a gestão de membros da team, convidar o email indicado, registar envio como AWAITING_ACCOUNT e só concluir após confirmar aceitação. No offboarding remover da team e confirmar. Coda/Freedcamp continuam visíveis sem links; o operador contacta o responsável do serviço. Drive da Presidência sem pasta configurada mantém um passo manual explícito para um responsável da Presidência. cPanel instrui criar/atualizar ou suspender a caixa aprovada, preservando conteúdo e sem recolher credenciais.

## Conectores e execução persistente

| Integração | Comportamento |
| --- | --- |
| Discord | Bot com MANAGE_ROLES e cargo acima dos cargos geridos; resolve username exato no servidor e confirma antes/depois. Cargos administrativos aprovados, incluindo server-manager, usam a mesma automação. Mantém justificação sensível, aprovação independente, exclusão de bots/roles geridas/@everyone e verificação de hierarquia. A pessoa tem de entrar no servidor antes de receber cargos. |
| GitHub | GitHub App com Members read/write e Metadata read; organização e slugs de equipas configurados. Convida por ID, verifica aceitação, cancela convites associados ao ID e remove pertença aprovada. Proprietários/maintainers e convites ambíguos por email vão para revisão manual. No offboarding da organização, deteta colaboração direta remanescente em repositórios visíveis à instalação. A App deve estar instalada em todos os repositórios abrangidos; a API não prova ausência de acessos fora dessa visibilidade. |
| Drive | Conta Google por email. Resolve IDs internamente, concede writer e verifica; atualiza readers/commenters diretos e cria concessão direta se a leitura for herdada. Revoga permissões diretas na pasta e descendentes. Propriedade/organizer, grupos, domínio, links, herança não removível e limites de varrimento ficam identificados como intervenção pendente, sem falsos sucessos. Não apaga ficheiros. A pasta sensível não é forçada para manual só pelo atributo sensitive; a aprovação continua obrigatória. |
| Figma, Coda, Freedcamp, WhatsApp, email | Operações persistentes manuais, instruções e links reservados, resultado e evidência atribuídos ao operador. Sem APIs fictícias para serviços ainda não confirmados. |

O executor corre no processo API, sem Redis/n8n/serviço adicional. Está desligado por defeito. Depois de configurar e aprovar pedidos de staging, ativar `ACCESS_EXECUTOR_ENABLED=true`, mantendo `ACCESS_EXECUTOR_DRY_RUN=true`. O dry-run faz consultas `VERIFY` e deixa `AWAITING_MANUAL` com indicação explícita de que não alterou acessos. Para executar realmente, definir `ACCESS_EXECUTOR_DRY_RUN=false`, reiniciar e repetir as operações aprovadas.

Uma operação é reclamada por compare-and-swap na BD, com lease de dois minutos renovada a cada 20 segundos. Reinícios recuperam leases expiradas. Revogações têm prioridade; erros transitórios usam backoff de 30 segundos até cinco tentativas automáticas e oito tentativas totais incluindo retries. Os conectores verificam estado antes de repetir alterações. O resultado mantém o username/email declarado além do ID técnico resolvido. Erros persistidos são códigos saneados, sem respostas completas nem credenciais.

Um convite pendente não conta como acesso concedido. Não repetir convites GitHub existentes. Usar Repetir / verificar aceitação para voltar a consultar. Falta de username/email aguarda conta; mudar o principal após aprovação exige novo pedido. Uma pessoa Discord que já declarou username mas ainda não entrou pode ser reconsultada sem inventar um ID. Resultados automáticos só admitem conclusão manual quando o conector declarou intervenção pendente. SKIPPED exige motivo e não afirma execução. O processo termina apenas quando não há passos pendentes, falhados ou por confirmar.

`Consultar inventário remoto parcial` é uma consulta sem mutações antes da aprovação, baseada nas contas/recursos já indicados no pedido. Discord mostra também roles adicionais detetadas, incluindo privilégios administrativos. Recurso não configurado detetado requer configuração e novo pedido; nunca é revogado implicitamente. `Consultar estado remoto` regista observações no histórico sem reabrir a aprovação nem alterar o resultado técnico anterior.

## Configuração de ambiente

Todas as variáveis estão em api/.env.example e nas variantes Compose; credenciais ficam apenas no servidor. Os originais Forms/Sheets permanecem na conta Google existente. O exemplo separado é criado manualmente pelo script autorizado nessa conta; o módulo não substitui nem publica os originais.

- Google: `ACCESS_FORMS_URL`, `ACCESS_SHEETS_ID`, `ACCESS_SHEETS_RANGE`, `ACCESS_SHEETS_COLUMNS`, `ACCESS_SHEETS_DEPARTMENTS`, `ACCESS_GOOGLE_CLIENT_EMAIL`, `ACCESS_GOOGLE_PRIVATE_KEY`. Ativar Sheets API e Drive API. Partilhar a folha apenas para leitura com a service account e conceder-lhe a capacidade necessária nos recursos Drive; não conceder acesso geral ao Workspace por defeito. Scopes dos tokens: Sheets readonly ou Drive, separados por utilização.
- Discord: `ACCESS_DISCORD_BOT_TOKEN`; IDs de guild/roles e links ficam nos recursos. Confirmar hierarquia real antes de ativar automação.
- GitHub: `ACCESS_GITHUB_APP_ID`, `ACCESS_GITHUB_INSTALLATION_ID`, `ACCESS_GITHUB_PRIVATE_KEY`. Usar chave da App e tokens de instalação de curta duração; sem PAT pessoal de administrador.
- Executor: `ACCESS_EXECUTOR_ENABLED=false` por defeito; `ACCESS_EXECUTOR_DRY_RUN=true` por defeito. O worker só inicia após o arranque normal do módulo, não durante geração OpenAPI.

PEMs podem usar quebras de linha reais ou `\n`. Na produção, guardar estas variáveis no secret storage do deployment. Tokens de acesso obtidos de Google/GitHub são mantidos apenas em memória até perto da expiração.

## API e validação operacional

Contrato em `api/openapi/openapi.json`; todas as rotas usam prefixo `/access-lifecycle`:

- `GET /configuration`, `GET /intake?query=...&offset=...`, `POST /preview`.
- `POST /resources`, `PUT /resources/:id`; `POST /policies`, `PUT /policies/:id`. Updates exigem a versão conhecida.
- `POST /processes`, `GET /processes` (estado, nome/email, provider/ID remoto, offset), `GET /processes/:id`, `GET /processes/:id/inventory`.
- `POST /processes/:id/submit`, `/decision` com `{approved,note}`, `/cancel`.
- `POST /processes/:id/operations/:operationId/confirm-manual`, `/retry`, `/reconcile`.

IDs de atores vêm sempre do JWT; campos forjados e flags verified são recusados. providerUserId aceita username Discord/GitHub, email Google ou IDs históricos. accountEmail aceita o email normal. verificationNote é contexto opcional, não uma prova que autorize automação. O servidor resolve identidades e verifica o resultado. Histórico pode ser pesquisado pelo username/email declarado, além do ID técnico. Seleção de recursos, justificação sensível/exceção e aprovação mantêm-se. A identidade AuthNEI futura não é uma dependência deste módulo.

Antes de produção, aplicar migrações numa base isolada, inicializar políticas, atribuir permissões a dois operadores distintos e executar um onboarding/offboarding de conta de teste. Confirmar acesso indevido entre departamentos, autoaprovação recusada, convite pendente, falha parcial, retry, restart durante execução, herança Drive e ausência de contas Orbit novas. Testes unitários/HTTP cobrem regras e mocks dos fornecedores; testes PostgreSQL em `api/test/access-lifecycle.e2e-spec.ts` verificam decisões/claims concorrentes e persistência. APIs reais exigem credenciais e recursos de staging; testes locais sem Docker não validam uma migração aplicada nem permissões reais dos fornecedores.

Rollback operacional: desligar executor, preservar tabelas/histórico e regressar à imagem anterior. Não remover a migração nem reverter automaticamente concessões já executadas; corrigir acessos com novo pedido aprovado. Retenção, substituto da Presidência e procedimentos de suspensão de emergência são decisões operacionais a confirmar.

Referências: [Discord guilds](https://docs.discord.com/developers/resources/guild), [GitHub members](https://docs.github.com/en/rest/orgs/members), [GitHub teams](https://docs.github.com/en/rest/teams/members), [Drive permissions](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions), [Sheets values.get](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get).
