# Preparação da release de acessos — PR #113

Verificação de produção em **2026-10-30 às 18:38 UTC**, apenas de leitura. Produção continua em `main` no commit `18acf35c816c7646e3d81168171d784ba80eee77`; este documento não afirma que o PR já foi publicado.

## Efeito esperado da migração operacional

Os cinco recursos estão ativos e configurados. Todos estão manuais na versão 2:

| Recurso | Estado observado | Efeito previsto no deploy |
| --- | --- | --- |
| Discord · Direção | `automatic=false`, versão 2 | `automatic=true`, versão 3 |
| Discord · Presi | `automatic=false`, versão 2 | `automatic=true`, versão 3 |
| Discord · server-manager | `automatic=false`, versão 2 | `automatic=true`, versão 3 |
| Drive · Direção | `automatic=false`, versão 2 | `automatic=true`, versão 3 |
| Drive · Geral | `automatic=false`, versão 2 | `automatic=true`, versão 3 |

É a alteração única pedida pelo responsável para automatizar cargos e pastas configurados, incluindo recursos sensíveis e revogações aprovadas. Não se trata de uma escolha nova de permissões para uma pessoa: cada pedido continua a exigir aprovação independente. Os snapshots de processos existentes mantêm a sua configuração original.

A configuração de produção no Coolify está preparada com `ACCESS_EXECUTOR_ENABLED=false`, `ACCESS_EXECUTOR_DRY_RUN=true` e `ACCESS_DISCORD_PRIVILEGED_GRANTS_ENABLED=false` explícito. Tornar um recurso automático não executa operações com o executor desligado. A última opção limita novas concessões administrativas Discord; não limita revogações quando o executor estiver ativo.

## Correção da auditoria

Foi retirada a migração proposta `20261030181500_access_operational_audit`, ainda ausente de `main` e `dev`. A consulta de produção encontrou zero eventos `ACCESS_OPERATIONAL_DEFAULTS_RECONCILED`; não foram encontrados registos desta reconciliação para limpar em produção. A migração operacional já aplicada em `dev` permanece intacta.

Não se criam eventos por recurso só por ele estar atualmente automático: isso não permite distinguir uma alteração da migração de uma escolha anterior de um administrador. Em instalações que já aplicaram a migração operacional não existe um estado anterior suficiente para reconstruir essa autoria. O registo acima é uma observação anterior ao deploy e uma previsão; deve ser comparado com o estado posterior, sem ser confundido com evidência de execução.

## Configuração que falta

- [ ] Executar o [script de criação](examples/orbit-member-form.gs) na conta Google correta, rever/publicar o novo Forms e fornecer os valores gerados `ACCESS_FORMS_ID`, `ACCESS_FORMS_URL` e `ACCESS_FORMS_FIELDS`. O Forms configurado ainda é o antigo: a API consegue lê-lo, mas não tem Departamento nem todas as contas. O registo manual `Membros!A1:L5000` continua separado e acessível, com 43 linhas na consulta.
- [ ] Colocar o cargo do bot Discord acima dos 11 cargos geridos. O bot já tem Manage Roles, mas todas as verificações de hierarquia falharam nesta consulta.
- [ ] Dar à conta de serviço capacidade de editar/partilhar a pasta Drive da Direção: a API devolveu `canEdit=false` e `canShare=false`. Drive Geral já devolveu ambas como verdadeiras.
- [ ] Configurar a pasta Drive da Presidência e partilhá-la com a conta de serviço. Até existir destino, o PR mantém instruções para execução manual pelo responsável.
- [ ] Completar os links administrativos/convites de Coda, Freedcamp e dos grupos WhatsApp em falta. São passos manuais e podem ser tratados pelo responsável mesmo sem link configurado; a release torna visíveis os passos de stock previstos. Figma e WhatsApp Geral já têm destino configurado.
- [ ] Definir/criar as caixas NEI internamente através da tarefa manual cPanel. O Forms não pede email NEI; não são necessárias credenciais da API cPanel para este fluxo manual.
- [ ] Fazer merge/deploy e verificar SHA, migrator, `/health`, frontend e fluxo autenticado. Repetir a consulta dos cinco recursos antes/depois; um build verde não demonstra publicação.
- [ ] Testar um pedido com conta real conhecida, aprovação de outra pessoa e executor em dry-run, após resolver os acessos externos. Só depois ativar a execução real. A automação de novas concessões administrativas requer também `ACCESS_DISCORD_PRIVILEGED_GRANTS_ENABLED=true`, além da aprovação e da hierarquia correta.

Google Forms/Sheets e GitHub autenticaram com sucesso. A GitHub App tem Members write, Metadata read e acesso a todos os repositórios da organização, sem suspensão. As credenciais Google/Discord/GitHub já existem; as pendências acima são de destinos, permissões externas, publicação e ativação.
