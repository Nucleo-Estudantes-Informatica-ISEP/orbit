# Gestão de acessos externos

O Orbit coordena onboarding, offboarding, alterações parciais e transições Alumni em `/dashboard/access`. Cada processo guarda a pessoa-alvo e os dados necessários como snapshot. Os operadores são os `User` existentes; este fluxo não cria contas Orbit nem desativa contas, identidades AuthNEI, mailboxes, documentos ou repositórios.

## Tipos de processo

- **Onboarding:** entrada de novos membros, inicialmente sem acessos, ou concessão de novas plataformas numa troca de departamento. O formulário de boas-vindas destina-se apenas à entrada de membros normais. O processo concede apenas os acessos selecionados e não revoga outros.
- **Offboarding:** saída do núcleo ou remoção de acessos que deixaram de ser necessários numa troca de departamento. Revoga apenas os acessos selecionados; uma saída completa exige rever todos os projetos/plataformas relevantes, sem presumir que o inventário parcial é exaustivo.
- **Transição Alumni:** saída especial aprovada que mantém o contacto por WhatsApp e Discord por predefinição. A política inicial inclui Discord Alumni e WhatsApp Alumínios. Outros acessos, como GitHub ou Drive, podem ser conservados escolhendo **Manter / conceder** no recurso e obtendo aprovação; os restantes podem ser removidos no mesmo pedido. As políticas continuam editáveis. Um destino WhatsApp ainda sem link mantém um passo manual visível para contactar o administrador do grupo e confirmar adesão.

Numa troca de departamento, os responsáveis confirmam que acessos continuam justificados antes de remover qualquer um. Pode usar-se onboarding para acrescentar e offboarding para retirar, ou **Alterar acessos** para combinar operações explicitamente selecionadas. Nenhum destes processos altera automaticamente o departamento da conta Orbit.

## Recolha de dados: respostas Forms e registo Sheets

Existem duas origens independentes, disponíveis em onboarding, offboarding, alterações de acesso e transições Alumni: **Respostas do Forms**, lidas diretamente pela Google Forms API e preferidas quando configuradas, e **Registo de membros (Sheets)**, a folha preenchida manualmente. O Sheets não é presumido como destino das respostas do Forms. A escolha fica explícita na pesquisa, no pedido e no histórico; não há fusão ou substituição silenciosa entre as origens. Introdução manual com referência continua disponível.

O Orbit copia apenas os dados necessários para o pedido escolhido, sem importar um diretório inteiro. Nome/email têm de corresponder ao registo selecionado. O hash do Forms inclui formulário, ID da resposta, data da última submissão e valores; respostas iguais de submissões diferentes mantêm identidades distintas e mostram a data, da mais recente para a mais antiga. No Sheets mantém-se o hash anterior para compatibilidade. Registos alterados ou duplicados de forma ambígua exigem nova pesquisa. O formulário e a folha originais são apenas lidos.

| Dado normal da pessoa | Quando é necessário | Cabeçalho compatível |
| --- | --- | --- |
| Nome e email de contacto | Todos | `Nome e Apelido`, `E-Mail Pessoal` |
| Departamento; cargo quando já conhecido no registo | Departamento obrigatório. O Forms de boas-vindas não pergunta cargo; apenas no onboarding, a UI sugere Membro se a resposta Forms não declarar cargo | `Departamento`; `Cargo` mantém-se no registo manual |
| Username Discord | Para os cargos no servidor; não é o nome de apresentação | `ID Discord` pode manter o nome e passar a guardar o username; também aceita `Username Discord` |
| Username GitHub | Informática e Coordenação de qualquer departamento | `Username GitHub` |
| Email da conta Google | Drive Geral e pastas aprovadas de Direção/Presidência | `Email Google` |
| Número de telemóvel com indicativo | Grupos WhatsApp | `Nº Telemóvel` |
| Email Figma | Informática e Marketing, ou exceção aprovada | `Email Figma` |
| Email Coda | Relações Externas, ou exceção aprovada | `Email Coda` |
| Email Freedcamp | Marketing, ou exceção aprovada | `Email Freedcamp` |
| Email NEI | Definido internamente pelos responsáveis ao preparar/executar a tarefa manual cPanel; nunca pedido no Forms de boas-vindas | `E-mail NEI` pode manter-se no registo manual existente |

Não pedir IDs de utilizador, IDs de permissões, UUIDs, passwords, tokens ou códigos MFA. Data de nascimento, ano, email ISEP e LinkedIn não são necessários para gerir acessos. O script de boas-vindas conserva as perguntas de identificação do modelo, incluindo email ISEP, e não acrescenta data de nascimento, ano ou LinkedIn. Esses dados adicionais não são copiados para os processos de acesso.

Os cabeçalhos atuais de `Membros` mantêm-se. `ACCESS_SHEETS_COLUMNS` permite títulos personalizados na folha; os mesmos aliases reconhecem títulos de perguntas no Forms, incluindo repetições de secções condicionais (primeiro valor não vazio). O mapeamento configurado tem prioridade sobre os aliases conhecidos, independentemente da ordem das colunas. `ACCESS_FORMS_FIELDS` permite mapear um campo para um título personalizado ou fixar um questionId específico; neste último caso, outras perguntas com o mesmo título não servem de fallback. A comparação de cabeçalhos, departamentos e cargos ignora espaços, maiúsculas e acentos. `ACCESS_SHEETS_DEPARTMENTS` converte rótulos de ambas as origens, como `Informática`, no UUID de Infraestruturas; `ACCESS_SHEETS_POSITIONS` permite traduções adicionais dos cargos declarados. Estes rótulos não atribuem permissões de operador.

Discord: se existir uma coluna/pergunta `Username Discord`, ou um mapeamento `discordUsername`, os seus valores são usernames e ficam separados do ID legado. Um username vazio não herda o valor de `ID Discord`; um ID legado numérico continua a ser um ID, sem conversão para username. Um mapeamento explícito de username fixa essa coluna/pergunta, incluindo valores vazios, e exclui-a dos IDs legados. Sem coluna ou mapeamento explícito de username, os cabeçalhos antigos continuam compatíveis: valores numéricos de 15–22 dígitos são IDs, outros valores podem ser usernames. Usernames numéricos intencionais exigem coluna ou mapeamento explícito de username. Perguntas, cabeçalhos e respostas existentes não são alterados.

Configurar `ACCESS_FORMS_ID` com o ID do endereço de **edição** `https://docs.google.com/forms/d/FORM_ID/edit`. O ID público `/d/e/...` e o link `forms.gle` não são esse ID; `ACCESS_FORMS_URL` serve apenas para abrir o formulário de preenchimento. Ativar Google Forms API no projeto da conta de serviço e partilhar o formulário para colaboração com essa conta. Os tokens da leitura Forms usam apenas `forms.body.readonly` e `forms.responses.readonly`, separados dos tokens Sheets/Drive. Não é necessário ligar uma folha ao Forms, criar Apps Script ou alterar títulos/perguntas para esta integração. Se os títulos não corresponderem aos aliases, configurar `ACCESS_FORMS_FIELDS`, por exemplo `{"name":"Nome completo","departments":"Qual o teu departamento?"}`. Para contacto, a resposta explícita de email tem prioridade; o email recolhido pelo Forms (`respondentEmail`) serve como fallback. A leitura pagina até 20 páginas de 500 respostas; se ultrapassar o limite ou repetir um token, falha explicitamente com 503 em vez de omitir respostas. As chamadas seguem [forms.get](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms/get) e [forms.responses.list](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms.responses/list).

O intervalo do registo manual é limitado e inclui cabeçalhos: `Membros!A1:L5000` para a fonte existente. Aumentar a última linha antes de a fonte ultrapassar esse limite. O Sheets de respostas novo é ligado ao Forms pelo script e não substitui este intervalo. A pesquisa exige três caracteres, aceita nomes sem acentos e termos separados, e devolve até 25 resultados por página (`offset`). Só mostra pessoas do âmbito departamental do operador. Um coordenador de Infra não encontra uma pessoa registada como Direção no Sheets; ADMIN/SYS-ADMIN com `ACCESS_ALL_DEPARTMENTS` veem os cinco departamentos.

O [Forms de boas-vindas](forms-member-example.md) e o [script de criação](examples/orbit-member-form.gs) criam apenas uma cópia do modelo e um Sheets novo ligado às respostas, na conta Google que os executar. Não eliminam ficheiros nem procuram cópias anteriores. Conservam os títulos do modelo e acrescentam Departamento e contas condicionais. Não perguntam cargo nem email NEI. Não há trigger de normalização nem folha Membros adicional: o registo manual atual e os seus cabeçalhos continuam intactos e independentes. Os links e o mapeamento completo ACCESS_FORMS_FIELDS aparecem no fim da execução.

O Orbit resolve usernames Discord/GitHub para IDs estáveis ao guardar o rascunho quando a conta já existe. A aprovação guarda esse principal. Uma conta Discord ainda fora do servidor mantém o username declarado e aguarda entrada; `retry` volta a pesquisar o username exato, nunca nomes de apresentação/apelidos. O conector confirma servidor, conta, hierarquia e estado antes/depois da alteração. GitHub confirma também o ID remoto. IDs numéricos históricos continuam compatíveis.

No Drive, indicar apenas o email Google: o conector encontra e valida internamente a permissão em concessões, consultas e revogações. O ID devolvido fica no resultado técnico para auditoria/retry; não é um campo do formulário. A comparação do email ignora maiúsculas/espaços exteriores. Pedidos antigos com ID explícito continuam a exigir correspondência com a conta e nunca são redirecionados silenciosamente para outro email. Alterar o email na UI substitui o principal e limpa contexto de verificação anterior.

Os dados do Forms são declarados pela pessoa. A confirmação técnica da conta e do resultado automático pertence ao Orbit; não se pede ao operador uma frase de verificação para desbloquear o executor. Isto não constitui prova de identidade civil. Serviços manuais são confirmados após execução com evidência atribuída ao operador.

Quando o registo selecionado declara Discord, GitHub ou Google, a API bloqueia uma conta diferente antes de guardar o pedido, incluindo nas revogações. Discord/GitHub permitem comparar o mesmo ID estável para compatibilidade com IDs históricos ou usernames alterados. O aprovador vê o username/email, o ID resolvido de Discord/GitHub e a origem da associação: correspondência com Forms, Sheets ou indicação do operador sem conta declarada na fonte. A origem fica no snapshot e é preservada pelo executor. Erros de conta inválida/ambígua ou divergente devolvem HTTP 400; configuração indisponível, limites do fornecedor e falhas remotas devolvem 503 com código saneado. Nesse caso não há rascunho parcial: corrigir a conta/configuração ou voltar a tentar quando o fornecedor recuperar.

## Aprovação e permissões

Na transição para Alumni, políticas sem restrição de cargos continuam a aplicar-se, tal como as políticas explícitas de Alumni. Um recurso é sugerido para concessão/manutenção quando pelo menos uma dessas políticas está ativa e corresponde aos departamentos do pedido; só é sugerido para revogação quando nenhuma política aplicável o mantém. A sobreposição com uma política restrita a membros não cancela esse acesso.

Em “Alterar acessos”, pedidos novos mantêm a ação Conceder e operações reutilizadas começam em Consultar. O username original fica no histórico; Drive reutiliza o email normal em todas as ações e mantém compatibilidade com IDs antigos. Repor predefinições preserva contas, justificações e seleções adicionais. A transição para Alumni exige um cargo de origem diferente de Alumni, validado na interface e na API.

O formulário de novo pedido separa **Pessoa → Contexto → Acessos**. Na primeira etapa, pesquisar e selecionar uma resposta do Forms/Sheets ou optar explicitamente por introdução manual com referência da origem. A pesquisa indica carregamento e ausência de resultados. Na segunda, confirmar tipo, departamentos, cargos e motivo; isto define o contexto do pedido, sem alterar a conta Orbit. Em onboarding com uma resposta Forms sem cargo, a UI seleciona Membro. A sugestão não se aplica a Sheets ou a outros tipos de processo, não substitui cargos declarados e é limpa quando se muda para outro tipo. Na terceira, os acessos das políticas são pré-selecionados e os restantes ficam em “Outros acessos”, com justificação obrigatória. Recursos sensíveis exigem igualmente justificação. A transição para Alumni acrescenta o contexto Alumni e sugere concessão dos seus recursos, com revogação dos anteriores.

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

Na imagem de produção: `node dist/prisma/seed.access.js`. O seed usa IDs determinísticos, não cria utilizadores e preserva recursos/políticas existentes (`upsert` sem updates). As políticas são editadas e versionadas na administração da app; alterações não modificam processos existentes. Recursos novos ficam visíveis; destinos ainda não configurados mantêm instruções manuais e não executam chamadas automáticas. A migração operacional ativa os quatro passos de stock ainda inalterados e, numa alteração intencional única, define `automatic=true` nos cinco IDs de stock Discord/Drive listados no SQL que estejam ativos e configurados. Esta última alteração aplica-se também a versões superiores a 1 e substitui uma escolha manual anterior nesses cinco recursos, conforme o requisito de automatizar os cargos/pastas configurados. Não altera políticas, recursos personalizados ou snapshots. Revisões posteriores continuam editáveis na BD e o seed não repõe essas flags.

A migração de contacto Alumni repõe também o passo WhatsApp Alumínios em instalações antigas onde o recurso de stock continua desativado, sem destino e na versão inicial. O passo permanece manual e visível sem link. Recursos configurados, versões posteriores editadas por administradores, políticas e snapshots não são alterados.

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
| Discord | Bot com MANAGE_ROLES e cargo acima dos cargos geridos; resolve username exato no servidor e confirma antes/depois. Cargos com Administrator, Manage Guild ou Manage Roles só podem ser automáticos se o recurso for sensível, validado pelos bits reais ao configurar e executar, independentemente do nome. Cargos administrativos aprovados, incluindo server-manager, usam a mesma automação. Mantém justificação sensível, aprovação independente, exclusão de bots/roles geridas/@everyone e verificação de hierarquia. A pessoa tem de entrar no servidor antes de receber cargos. |
| GitHub | GitHub App com Members read/write e Metadata read; organização e slugs de equipas configurados. Convida por ID, verifica aceitação, cancela convites associados ao ID e remove pertença aprovada. Proprietários/maintainers e convites ambíguos por email vão para revisão manual. No offboarding da organização, deteta colaboração direta remanescente em repositórios visíveis à instalação. A App deve estar instalada em todos os repositórios abrangidos; a API não prova ausência de acessos fora dessa visibilidade. |
| Drive | Conta Google por email. Resolve IDs internamente, concede writer e verifica; atualiza readers/commenters diretos e cria concessão direta se a leitura for herdada. Revoga permissões diretas na pasta e descendentes. Propriedade/organizer, grupos, domínio, links, herança não removível e limites de varrimento ficam identificados como intervenção pendente, sem falsos sucessos. Não apaga ficheiros. A pasta sensível não é forçada para manual só pelo atributo sensitive; a aprovação continua obrigatória. |
| Figma, Coda, Freedcamp, WhatsApp, email | Operações persistentes manuais, instruções e links reservados, resultado e evidência atribuídos ao operador. Sem APIs fictícias para serviços ainda não confirmados. |

Drive sensível: a remoção do bloqueio baseado apenas em `inheritedPermissionsDisabled=false` é intencional, para permitir gerir automaticamente a concessão direta aprovada quando a lista de permissões não revela acesso indireto. Antes de conceder, o Orbit consulta as permissões; se encontrar herança, grupo, domínio ou link público, devolve `AWAITING_MANUAL` para auditoria dessa origem sem escrever no Drive. Isto gere o principal aprovado e não certifica o isolamento completo da pasta nem a pertença a grupos. No offboarding, acessos indiretos remanescentes continuam a impedir um resultado de revogação completa.

O executor corre no processo API, sem Redis/n8n/serviço adicional. Está desligado por defeito. Depois de configurar e aprovar pedidos de staging, ativar `ACCESS_EXECUTOR_ENABLED=true`, mantendo `ACCESS_EXECUTOR_DRY_RUN=true`. O dry-run faz consultas `VERIFY` e deixa `AWAITING_MANUAL` com indicação explícita de que não alterou acessos. Para executar realmente, definir `ACCESS_EXECUTOR_DRY_RUN=false`, reiniciar e repetir as operações aprovadas.

Uma operação é reclamada por compare-and-swap na BD, com lease de dois minutos renovada a cada 20 segundos. Reinícios recuperam leases expiradas. Revogações têm prioridade; erros transitórios usam backoff de 30 segundos até cinco tentativas automáticas e oito tentativas totais incluindo retries. Os conectores verificam estado antes de repetir alterações. O resultado mantém o username/email declarado além do ID técnico resolvido. Erros persistidos são códigos saneados, sem respostas completas nem credenciais.

Um convite pendente não conta como acesso concedido. Não repetir convites GitHub existentes. Usar Repetir / verificar aceitação para voltar a consultar. Falta de username/email aguarda conta; mudar o principal após aprovação exige novo pedido. Uma pessoa Discord que já declarou username mas ainda não entrou pode ser reconsultada sem inventar um ID. Resultados automáticos só admitem conclusão manual quando o conector declarou intervenção pendente. SKIPPED exige motivo e não afirma execução. O processo termina apenas quando não há passos pendentes, falhados ou por confirmar.

`Consultar inventário remoto parcial` é uma consulta sem mutações antes da aprovação, baseada nas contas/recursos já indicados no pedido. Discord mostra também roles adicionais detetadas, incluindo privilégios administrativos. Recurso não configurado detetado requer configuração e novo pedido; nunca é revogado implicitamente. `Consultar estado remoto` regista observações no histórico sem reabrir a aprovação nem alterar o resultado técnico anterior.

A pesquisa de histórico por conta externa exige pelo menos três caracteres após retirar espaços exteriores. O filtro procura username declarado, email e ID legado; consultas menores são rejeitadas antes da pesquisa na BD.

## Configuração de ambiente

Após configurar as duas origens em staging, confirmar que `GET /configuration` anuncia `FORMS` e `SHEETS`. Com um operador de um departamento, pesquisar uma resposta conhecida desse departamento em cada origem e confirmar que não aparecem pessoas de outro departamento. Na UI, selecionar uma pessoa no Forms e trocar para Sheets: a seleção anterior deve ficar limpa. Preparar rascunhos de onboarding e offboarding a partir de cada origem, verificar a conta, o tipo de origem no histórico e a fonte no resultado, sem submeter para execução real. O teste ao vivo da Forms API exige ID de edição, API ativa e partilha; os testes locais simulam essas respostas e não comprovam essa configuração externa.

Todas as variáveis estão em api/.env.example e nas variantes Compose; credenciais ficam apenas no servidor. Os originais Forms/Sheets permanecem na conta Google existente. O exemplo separado é criado manualmente pelo script autorizado nessa conta; o módulo não substitui nem publica os originais.

- Google: `ACCESS_FORMS_URL`, `ACCESS_FORMS_ID`, `ACCESS_FORMS_FIELDS`, `ACCESS_SHEETS_ID`, `ACCESS_SHEETS_RANGE`, `ACCESS_SHEETS_COLUMNS`, `ACCESS_SHEETS_DEPARTMENTS`, `ACCESS_SHEETS_POSITIONS`, `ACCESS_GOOGLE_CLIENT_EMAIL`, `ACCESS_GOOGLE_PRIVATE_KEY`. Ativar Forms API, Sheets API e Drive API conforme as integrações usadas. Partilhar o formulário com a conta de serviço, a folha apenas para leitura e conceder a capacidade necessária nos recursos Drive; não conceder acesso geral ao Workspace por defeito. Scopes e caches dos tokens Forms readonly, Sheets readonly e Drive são separados. A configuração de uma origem não exige a outra.
- Discord: `ACCESS_DISCORD_BOT_TOKEN`; IDs de guild/roles e links ficam nos recursos. Confirmar hierarquia real antes de ativar automação.
- GitHub: `ACCESS_GITHUB_APP_ID`, `ACCESS_GITHUB_INSTALLATION_ID`, `ACCESS_GITHUB_PRIVATE_KEY`. Usar chave da App e tokens de instalação de curta duração; sem PAT pessoal de administrador.
- Executor: `ACCESS_EXECUTOR_ENABLED=false` por defeito; `ACCESS_EXECUTOR_DRY_RUN=true` por defeito. O worker só inicia após o arranque normal do módulo, não durante geração OpenAPI.

PEMs podem usar quebras de linha reais ou `\n`. Na produção, guardar estas variáveis no secret storage do deployment. Tokens de acesso obtidos de Google/GitHub são mantidos apenas em memória até perto da expiração.

## API e validação operacional

Contrato em `api/openapi/openapi.json`; todas as rotas usam prefixo `/access-lifecycle`:

- `GET /configuration` inclui `intakeSources`; `GET /intake?query=...&intakeSource=FORMS|SHEETS&offset=...` pesquisa só a origem escolhida; `POST /preview`.
- `POST /processes` aceita `intakeKey` com `intakeSource` e volta a ler o mesmo registo nessa origem. Clientes antigos sem seletor continuam suportados; a pesquisa prefere Forms quando configurado e o lookup por hash aceita chaves antigas do Sheets, mesmo com falha na origem Forms.
- `POST /resources`, `PUT /resources/:id`; `POST /policies`, `PUT /policies/:id`. Updates exigem a versão conhecida.
- `POST /processes`, `GET /processes` (estado, nome/email, provider/ID remoto, offset), `GET /processes/:id`, `GET /processes/:id/inventory`.
- `POST /processes/:id/submit`, `/decision` com `{approved,note}`, `/cancel`.
- `POST /processes/:id/operations/:operationId/confirm-manual`, `/retry`, `/reconcile`.

IDs de atores vêm sempre do JWT; campos forjados e flags verified são recusados. providerUserId aceita username Discord/GitHub, email Google ou IDs históricos. accountEmail aceita o email normal. verificationNote é contexto opcional, não uma prova que autorize automação. O servidor resolve identidades e verifica o resultado. Histórico pode ser pesquisado pelo username/email declarado, além do ID técnico. Seleção de recursos, justificação sensível/exceção e aprovação mantêm-se. A identidade AuthNEI futura não é uma dependência deste módulo.

Antes de produção, aplicar migrações numa base isolada, inicializar políticas, atribuir permissões a dois operadores distintos e executar um onboarding/offboarding de conta de teste. Confirmar acesso indevido entre departamentos, autoaprovação recusada, convite pendente, falha parcial, retry, restart durante execução, herança Drive e ausência de contas Orbit novas. Testes unitários/HTTP cobrem regras e mocks dos fornecedores; testes PostgreSQL em `api/test/access-lifecycle.e2e-spec.ts` verificam decisões/claims concorrentes e persistência. APIs reais exigem credenciais e recursos de staging; testes locais sem Docker não validam uma migração aplicada nem permissões reais dos fornecedores.

Rollback operacional: desligar executor, preservar tabelas/histórico e regressar à imagem anterior. Não remover a migração nem reverter automaticamente concessões já executadas; corrigir acessos com novo pedido aprovado. Retenção, substituto da Presidência e procedimentos de suspensão de emergência são decisões operacionais a confirmar.

Referências: [Discord guilds](https://docs.discord.com/developers/resources/guild), [GitHub members](https://docs.github.com/en/rest/orgs/members), [GitHub teams](https://docs.github.com/en/rest/teams/members), [Drive permissions](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions), [Sheets values.get](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get).
