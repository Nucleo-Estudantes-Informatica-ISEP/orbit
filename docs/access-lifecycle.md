# Gestão de acessos externos

O Orbit coordena onboarding, offboarding, alterações parciais e transições Alumni em `/dashboard/access`. Cada processo guarda a pessoa-alvo e os dados necessários como snapshot. Os operadores são os `User` existentes; este fluxo não cria contas Orbit nem desativa contas, identidades AuthNEI, mailboxes, documentos ou repositórios.

## Recolha de dados: Google Forms → Google Sheets

Os membros respondem a um Google Forms. As respostas ficam no Sheets associado; o Orbit pesquisa essa fonte e copia apenas os dados necessários para o pedido escolhido. Não importa toda a folha para um diretório de membros. Nome/email do pedido têm de corresponder à resposta selecionada. A resposta é referenciada por hash dos seus valores e da origem: se mudar ou existir duplicada, o operador deve voltar a pesquisar.

| Dado | Quando é necessário | Campo predefinido no Sheets |
| --- | --- | --- |
| Nome | Todos os pedidos | `Nome` |
| Email de contacto | Todos os pedidos | `Email` |
| Departamentos | Todos; converter rótulos para UUIDs existentes | `Departamentos` |
| Cargos | Para calcular predefinições; valores abaixo | `Cargos` |
| Discord ID | Operações Discord | `Discord ID` |
| GitHub ID numérico | Informática e Coordenação | `GitHub ID` |
| Principal/email Google | Drive | `Email Google` |
| Telefone internacional | WhatsApp manual | `Telefone` |
| Email da conta Figma | Informática e Marketing | `Email Figma` |

`Cargos` aceita `MEMBER`, `COORDINATOR`, `CO_COORDINATOR`, `BOARD`, `PRESIDENCY`, `ALUMNI`. Separar vários departamentos/cargos por vírgula ou ponto e vírgula. Configurar secções condicionais no Forms para pedir apenas contas necessárias aos serviços de cada departamento. Não recolher passwords, tokens, códigos MFA ou credenciais administrativas. Figma, Coda e Freedcamp usam teams com convite; identificar a conta verificada e registar envio, aceitação e remoção como operações manuais aprovadas.

O mapeamento predefinido é:

```json
{"name":"Nome","email":"Email","departments":"Departamentos","positions":"Cargos","discordId":"Discord ID","githubId":"GitHub ID","googleEmail":"Email Google","phone":"Telefone","figmaEmail":"Email Figma"}
```

Pode ser substituído por `ACCESS_SHEETS_COLUMNS`. Em `ACCESS_SHEETS_DEPARTMENTS`, mapear rótulos reais para UUIDs: `{"Informática":"<uuid>","Marketing":"<uuid>"}`. A folha deve incluir cabeçalhos e um intervalo limitado, por exemplo `'Respostas ao formulário 1'!A1:Z5000`. Aumentar a última linha antes de a fonte ultrapassar o intervalo; a aplicação não solicita linhas fora dele. A pesquisa exige pelo menos três caracteres e devolve até 25 resultados, filtrados pelo âmbito departamental do operador. O índice `offset` permite continuar a pesquisa pela API.

O Sheets existente pode manter os seus cabeçalhos. Por exemplo, `{"name":"Nome e Apelido","email":"E-Mail Pessoal","phone":"Nº Telemóvel","departments":"Departamento","positions":"Cargo","discordId":"ID Discord"}` permite usar a folha `Membros!A1:L5000`. Campos opcionais sem coluna ficam vazios: não se presume que o email pessoal seja a conta Google ou Figma. Data de nascimento, ano, email institucional e LinkedIn não são copiados para os pedidos. `ACCESS_SHEETS_POSITIONS` traduz cargos declarados, por exemplo `{"Coordenador":"COORDINATOR","Direção":"BOARD","Presidência":"PRESIDENCY"}`; isto preenche o contexto do pedido e não atribui permissões de operador.

As contas declaradas no Forms são pistas de preenchimento. Um operador deve confirmar a identidade na plataforma e registar como a verificou. Um email isolado não permite revogação. No Drive, usar o ID de permissão remoto confirmado para revogar. Para a primeira concessão, preencher `providerUserId` e `accountEmail` com o mesmo email Google verificado; a comparação ignora maiúsculas e espaços exteriores. Um ID de permissão existente só é aceite quando corresponde ao utilizador na pasta e, se fornecido, ao email da conta. Um ID não encontrado nunca é substituído por uma pesquisa por email nem permite criar acesso para outro principal. O conector guarda o ID de permissão devolvido para futuras operações. GitHub resolve o ID numérico para o login atual e compara o ID antes de atuar.

Pedidos sobre acessos antigos, respostas indisponíveis ou processos anteriores também podem ser criados com introdução manual, desde que seja indicada a origem. Reutilizar histórico mantém os IDs como sugestões e limpa a evidência de verificação; é necessário confirmar novamente antes de revogar.

## Aprovação e permissões

O formulário de novo pedido separa **Pessoa → Contexto → Acessos**. Na primeira etapa, pesquisar e selecionar uma resposta do Forms/Sheets ou optar explicitamente por introdução manual com referência da origem. A pesquisa indica carregamento e ausência de resultados. Na segunda, confirmar tipo, departamentos, cargos e motivo; isto define o contexto do pedido, sem alterar a conta Orbit. Na terceira, os acessos das políticas são pré-selecionados e os restantes ficam em “Outros acessos”, com justificação obrigatória. Recursos sensíveis exigem igualmente justificação. A transição para Alumni acrescenta o contexto Alumni e sugere concessão dos seus recursos, com revogação dos anteriores.

Cada plataforma mostra a identificação relevante: ID Discord/GitHub, telefone WhatsApp e email para teams manuais/email institucional. Na primeira concessão Drive, o único email preenche principal e conta; um ID de permissão existente é opcional. Revogar/consultar Drive pede ID da permissão. Alterar a identidade limpa a evidência anterior. Pedidos de concessão incompletos continuam permitidos, mas a execução automática aguarda identificação verificada e a sua correção exige novo pedido. A configuração devolve `executorEnabled` e `dryRun` para mostrar o modo efetivo de execução; a capacidade de automação de cada recurso é indicada separadamente.

Todas as rotas têm autenticação JWT e verificam no servidor o estado atual do operador e as suas permissões na base de dados. O departamento do JWT/cliente não é usado como prova de autorização.

| Permissão | Uso |
| --- | --- |
| `ACCESS_READ` | Configuração visível, processos, pesquisa e inventário parcial dentro do âmbito permitido; obrigatória em todas as ações |
| `ACCESS_CREATE` | Pesquisar respostas, preparar, submeter e cancelar pedidos próprios ainda não aprovados |
| `ACCESS_APPROVE` | Decidir pedidos; atribuir apenas à Presidência/substitutos formalmente autorizados |
| `ACCESS_EXECUTE` | Evidências manuais, retries e observações remotas |
| `ACCESS_MANAGE` | Recursos/políticas; exige também âmbito global |
| `ACCESS_ALL_DEPARTMENTS` | Âmbito global explícito; isoladamente não dá permissão de ação |

Sem âmbito global, todos os departamentos do pedido têm de ser o departamento atual do operador. Um processo que abranja vários departamentos só pode ser gerido por um operador global. Atribuir à Coordenação `READ`, `CREATE` e, se adequado, `EXECUTE`; atribuir à Presidência `READ`, `APPROVE` e `ALL_DEPARTMENTS`. A administração pode ter as seis permissões. Autoaprovação é sempre recusada, incluindo administradores.

O processo passa por `DRAFT → PENDING_APPROVAL → APPROVED|REJECTED`. Só o autor submete/cancela, antes da decisão. A decisão e o snapshot completo são gravados na mesma transação, com controlo de versão para impedir decisões concorrentes. Dados e operações são imutáveis: correções exigem novo pedido. A aprovação cobre os recursos concretos; recursos sensíveis ou fora da predefinição exigem justificação individual. `OFFBOARD` não pode conceder acessos; Alumni exige `ALUMNI_TRANSITION` explícito. Antes de revogar, solicitante e Presidência devem confirmar se outra função/departamento ainda legitima o acesso.

Links administrativos/convites só aparecem na configuração para administradores e nos processos aprovados para executores autorizados. Não são expostos no preview, rascunhos ou histórico decidido. Histórico, evidências e snapshots preservam a atribuição ao operador. A organização deve definir retenção de dados pessoais e responsáveis por consultar/exportar o histórico; este módulo não presume um inventário completo de todos os membros.

## Catálogo e predefinições

Depois de aplicar a migração, executar a inicialização **uma vez**, e novamente apenas para acrescentar predefinições em falta:

```bash
cd api
npm run access:seed
```

Na imagem de produção: `node dist/prisma/seed.access.js`. O seed não cria utilizadores, preserva recursos/políticas existentes, usa IDs determinísticos e acrescenta permissões de acessos ao role `ADMIN` existente. Recursos novos ficam **desativados**, com `CONFIGURE_ME`; é necessário preencher os IDs reais e ativá-los na área de configuração. As políticas são versionadas; alterações não modificam processos existentes. Para departamentos com nomes diferentes de Informática, Marketing e Relações Externas, ajustar as políticas na interface.

Instalações com configuração já recolhida podem definir `ACCESS_BOOTSTRAP_RESOURCES` e `ACCESS_BOOTSTRAP_ROLE_PERMISSIONS` antes de executar o seed. Exemplo sem credenciais nem convites privados:

```json
{"figma":{"remoteId":"TEAM_ID","enabled":true,"automatic":false},"drive-general":{"remoteId":"FOLDER_ID","enabled":true,"automatic":false}}
```

Chaves estáveis disponíveis incluem `discord-members`, `discord-board`, `discord-presidency`, `discord-coordinator`, `discord-co-coordinator`, `discord-alumni`, `discord-server-manager`, `discord:department:<uuid>`, `drive-general`, `drive-board`, `drive-presidency`, `github`, `figma`, `whatsapp-general` e os restantes identificadores definidos no seed. Cada patch aceita apenas `remoteId`, `containerId`, `adminUrl` HTTPS, `enabled` e `automatic`. Recursos/papéis são validados antes da aplicação transacional. Repetir um patch igual não incrementa a versão. Recursos sem patch continuam desativados; o executor mantém a configuração independente `ACCESS_EXECUTOR_ENABLED=false`.

Uma configuração explícita de roles, como `{"COORDENADOR":["ACCESS_READ","ACCESS_CREATE","ACCESS_EXECUTE"]}`, substitui apenas permissões `ACCESS_*` desses roles e preserva todas as outras. Nesse modo não é aplicada a concessão predefinida de todas as permissões ao `ADMIN`. Na configuração confirmada desta instalação, `SYS-ADMIN` tem todas as seis permissões, incluindo `ACCESS_APPROVE`; os `ADMIN` da Presidência também podem aprovar. A regra de quatro olhos continua a impedir autoaprovação. Não são criados roles, contas ou novos vínculos de utilizador. O nome departamental `Infraestruturas Informáticas` é reconhecido para as predefinições de Informática.

Inclui Discord Members/departamento/cargos, Drive Geral/Direção/Presidência, GitHub para Informática ou Coordenação, Figma para Informática/Marketing, Coda para Relações Externas, Freedcamp para Marketing e grupos WhatsApp. `server-manager` e email institucional são exceções manuais sensíveis, sem predefinição. Bots Discord, `INSIDE NEI`, anos letivos, `new-members` e tesouraria não têm atribuições automáticas implícitas.

Figma, Coda e Freedcamp são **teams que exigem convite**. Registar convite enviado como `AWAITING_ACCOUNT`; só confirmar `SUCCEEDED` depois de verificar aceitação/pertença. No offboarding confirmar remoção da team. Os três serviços usam execução manual; Coda/Freedcamp só aguardam identificação/link das teams para ativação dos recursos. WhatsApp exige confirmação individual de comunidade/grupos, incluindo Geral, departamento, Rubis e Alumínios conforme aprovação. Email cPanel permanece manual e não recolhe credenciais na evidência.

## Conectores e execução persistente

| Integração | Comportamento |
| --- | --- |
| Discord | Bot com `MANAGE_ROLES`; IDs de servidor/role; conta confirmada; verifica hierarquia e estado antes/depois. Exclui bots, roles geridas, `@everyone` e remete roles administrativas para confirmação manual. Convite ao servidor é manual; a role aguarda entrada. Alumni é um recurso selecionado explicitamente. |
| GitHub | GitHub App com Members read/write e Metadata read; organização e slugs de equipas configurados. Convida por ID, verifica aceitação, cancela convites associados ao ID e remove pertença aprovada. Proprietários/maintainers e convites ambíguos por email vão para revisão manual. No offboarding da organização, deteta colaboração direta remanescente em repositórios visíveis à instalação. A App deve estar instalada em todos os repositórios abrangidos; a API não prova ausência de acessos fora dessa visibilidade. |
| Drive | Service account com acesso explícito aos recursos. Concede permissão `writer` a conta verificada, guarda o ID devolvido e confirma identidade e acesso de escrita. Permissões existentes `writer`, `fileOrganizer`, `organizer` ou `owner` satisfazem a concessão sem alteração; `reader`, `commenter` ou roles desconhecidos ficam em `AWAITING_MANUAL` para conceder escrita e confirmar com evidência, incluindo acesso herdado insuficiente. Pastas sensíveis exigem acesso limitado; revoga grants diretos na pasta e descendentes. Na revogação, herança, grupos, domínio, links, propriedade/organizer e limites de varrimento exigem intervenção; não há falsos sucessos nesses casos. Não apaga ficheiros. |
| Figma, Coda, Freedcamp, WhatsApp, email | Operações persistentes manuais, instruções e links reservados, resultado e evidência atribuídos ao operador. Sem APIs fictícias para serviços ainda não confirmados. |

O executor corre no processo API, sem Redis/n8n/serviço adicional. Está desligado por defeito. Depois de configurar e aprovar pedidos de staging, ativar `ACCESS_EXECUTOR_ENABLED=true`, mantendo `ACCESS_EXECUTOR_DRY_RUN=true`. O dry-run faz consultas `VERIFY` e deixa `AWAITING_MANUAL` com indicação explícita de que não alterou acessos. Para executar realmente, definir `ACCESS_EXECUTOR_DRY_RUN=false`, reiniciar e repetir as operações aprovadas.

Uma operação é reclamada por compare-and-swap na base de dados, com lease de dois minutos renovada a cada 20 segundos. Um restart permite recuperar leases expiradas. A fila dá prioridade a revogações; falhas transitórias têm backoff exponencial de 30 segundos, até cinco tentativas automáticas. O total é limitado a oito tentativas incluindo retries explícitos. Todos os conectores consultam estado remoto antes de alterações repetidas. Erros persistidos são códigos saneados; nunca corpos de respostas de fornecedores, tokens ou passwords.

Um convite pendente não conta como acesso concedido. O executor não repete convites GitHub já pendentes. Usar `Repetir / verificar aceitação` para verificar novamente. Operações sem ID/evidência aguardam conta; preencher identidades novas exige pedido revisto e aprovação. Resultados automáticos só podem ser concluídos manualmente quando o conector identificou necessidade de intervenção. Uma evidência `SKIPPED` dispensa o passo com motivo, sem afirmar que foi executado. O processo só termina quando não existem operações pendentes, falhadas ou por confirmar.

`Consultar inventário remoto parcial` é uma consulta sem mutações antes da aprovação, baseada nas contas/recursos já indicados no pedido. Discord mostra também roles adicionais detetadas, incluindo privilégios administrativos. Recurso não configurado detetado requer configuração e novo pedido; nunca é revogado implicitamente. `Consultar estado remoto` regista observações no histórico sem reabrir a aprovação nem alterar o resultado técnico anterior.

## Configuração de ambiente

Todas as variáveis estão em `api/.env.example` e são encaminhadas pelas três variantes Compose. Não usar `NEXT_PUBLIC_*` para credenciais. O Forms e o Sheets continuam a existir na conta Google da organização; este código não cria formulários nem partilha folhas publicamente.

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

IDs de atores são sempre extraídos do JWT; campos adicionais são recusados, incluindo ator forjado ou flags `verified`. O contrato aceita seleção de recursos, ID remoto, email da conta, evidência de verificação e justificação de exceção. A futura identidade AuthNEI da pessoa-alvo pode ser acrescentada ao snapshot sem alterar a autenticação dos operadores; este módulo não depende da issue #31.

Antes de produção, aplicar migrações numa base isolada, inicializar políticas, atribuir permissões a dois operadores distintos e executar um onboarding/offboarding de conta de teste. Confirmar acesso indevido entre departamentos, autoaprovação recusada, convite pendente, falha parcial, retry, restart durante execução, herança Drive e ausência de contas Orbit novas. Testes unitários/HTTP cobrem regras e mocks dos fornecedores; testes PostgreSQL em `api/test/access-lifecycle.e2e-spec.ts` verificam decisões/claims concorrentes e persistência. APIs reais exigem credenciais e recursos de staging; testes locais sem Docker não validam uma migração aplicada nem permissões reais dos fornecedores.

Rollback operacional: desligar executor, preservar tabelas/histórico e regressar à imagem anterior. Não remover a migração nem reverter automaticamente concessões já executadas; corrigir acessos com novo pedido aprovado. Retenção, substituto da Presidência e procedimentos de suspensão de emergência são decisões operacionais a confirmar.

Referências: [Discord guilds](https://docs.discord.com/developers/resources/guild), [GitHub members](https://docs.github.com/en/rest/orgs/members), [GitHub teams](https://docs.github.com/en/rest/teams/members), [Drive permissions](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions), [Sheets values.get](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get).
