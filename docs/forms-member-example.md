# Forms de exemplo, separado dos originais

O [script Apps Script](examples/orbit-member-form.gs) cria um **Google Forms novo, não publicado**, e um **Sheets novo** na conta que o executar. Não contém IDs de ficheiros originais, não substitui partilhas/configuração da app e não edita respostas existentes. O trigger só aceita respostas do formulário que este projeto criou e só escreve na folha nova registada pelo script.

## Dados pedidos

| Campo normal | Condição |
| --- | --- |
| Nome e Apelido, Nº Telemóvel, E-Mail Pessoal, Cargo, Departamento | Todos os perfis; o telefone permite gerir os grupos WhatsApp |
| Username Discord | Todos; opcional enquanto a pessoa ainda não tiver conta. Username da conta, sem ID nem nome de apresentação |
| Email Google | Perfis ativos. Se for igual ao email pessoal, a pessoa pode deixar vazio: o texto declara explicitamente essa equivalência |
| Username GitHub | Informática ou Coordenação/Co-coordenação de qualquer departamento |
| Email Figma | Informática ou Marketing |
| Email Coda | Relações Externas |
| Email Freedcamp | Marketing |
| E-mail NEI existente/pretendido | Coordenação, Direção e Presidência; opcional, apenas se existir ou tiver sido pedido |

Para os emails de teams, deixar vazio declara explicitamente que se usa o email pessoal. A normalização só preenche esses emails quando a secção do serviço se aplica. Isto não é uma suposição feita pelo importador para folhas antigas. Se a pessoa ainda não tem uma conta, deve criá-la ou pedir ajuda ao responsável. O conector pode aguardar entrada/aceitação, sem inventar identidades.

Alumni não preenche Google/GitHub/Figma/Coda/Freedcamp. A Coordenação de Informática só vê GitHub uma vez. O Forms usa departamento principal, como a folha atual; vínculos adicionais são confirmados no Orbit por um operador autorizado. As secções refletem as políticas iniciais; se forem alteradas na app, ajustar também o exemplo antes de o adotar. Pedidos de ferramentas adicionais podem ser tratados pelo operador no catálogo completo com justificação e aprovação.

Não se pedem IDs numéricos, IDs de permissões Google, passwords, tokens, códigos MFA, data de nascimento, ano, LinkedIn ou email ISEP. Aprovação, motivo e escolha das operações pertencem ao operador no Orbit, sem exigir que o membro conheça a configuração técnica.

## Cabeçalhos preservados

A folha normalizada nova chama-se `Membros`. A linha A:L mantém, na mesma ordem:

`Nome e Apelido`, `Nº Telemóvel`, `E-Mail Pessoal`, `Data de Nascimento`, `E-Mail ISEP`, `E-mail NEI`, `Ano`, `Departamento`, `Cargo`, `Título`, `ID Discord`, `Perfil LinkedIn `.

As colunas sem dados necessários ficam vazias. O cabeçalho histórico `ID Discord` passa a conter o username normal. A coluna M:Q acrescenta apenas `Email Google`, `Username GitHub`, `Email Figma`, `Email Coda`, `Email Freedcamp`. O script conserva respostas brutas na folha de respostas do Forms e normaliza as secções condicionais na cópia `Membros`; títulos repetidos não obrigam a renomear cabeçalhos. As respostas não são publicadas.

## Criar na própria conta Google

1. No navegador normal, com a conta pretendida iniciada, abrir [um projeto Apps Script novo](https://script.google.com/home/projects/create).
2. Colar o conteúdo de [orbit-member-form.gs](examples/orbit-member-form.gs) no projeto novo e guardar. Não associar o projeto ao Forms/Sheets original.
3. Selecionar `createOrbitMemberExample`, executar e autorizar a criação do Forms/Sheets e o trigger desse exemplo. As permissões pertencem à conta Google em que se iniciou sessão; não usar a service account da app como proprietária do exemplo.
4. Abrir os links devolvidos no registo de execução. Rever o formulário no editor e no modo de pré-visualização; só publicar quando se pretender aceitar respostas de teste. Uma nova execução cria outro exemplo, sem substituir ficheiros anteriores.

O login Google rejeitou o browser automatizado desta sessão com “Este navegador ou esta aplicação podem não ser seguros”. Por isso, fornecer o script pronto não significa que os ficheiros já estejam criados na conta do utilizador; a execução deve ser concluída no navegador normal.

Se o exemplo for adotado mais tarde, partilhar **a folha nova** apenas com a service account já usada pelo Orbit e usar o intervalo `Membros!A1:Q5000` no ambiente de teste. Os aliases do importador reconhecem os novos cabeçalhos, mesmo mantendo o mapeamento existente das colunas antigas. Não apontar produção para o exemplo sem decidir explicitamente essa adoção; não é necessário alterar os originais para o testar.

Validação local: `node --test docs/examples/orbit-member-form.test.cjs`. Cobre 30 combinações de perfis, preservação dos cabeçalhos, cópia apenas para a folha criada, respostas duplicadas e rejeição de eventos de outros Forms. A execução real na Google continua necessária para validar consentimento, layout e trigger.

Referências: [FormApp](https://developers.google.com/apps-script/reference/forms/form-app), [navegação em listas](https://developers.google.com/apps-script/reference/forms/list-item), [navegação antes de page breaks](https://developers.google.com/apps-script/reference/forms/page-break-item).
