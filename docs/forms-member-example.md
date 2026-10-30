# Formulário de boas-vindas para novos membros

O [script Apps Script](examples/orbit-member-form.gs) cria uma **cópia nova do formulário de boas-vindas** e um **Sheets novo ligado às respostas**, na conta Google que o executar. Não elimina ficheiros, não procura cópias anteriores e não altera os originais nem a configuração do Orbit. O formulário fica fechado para revisão.

## Dados e condições

Todos são membros normais a entrar. Não existe pergunta de cargo, Presidência, Coordenação ou Alumni. Não se menciona nem pede um endereço email NEI: a caixa é definida e criada manualmente pelos responsáveis no Orbit/cPanel.

Mantêm-se os títulos de identificação do modelo: Nome completo, Número Mecanográfico, Email Institucional (ISEP), Email Pessoal, Número de telemóvel, Instagram Handle e Discord Handle. Instagram fica opcional. Conservam-se a pergunta do polo, os guias/opções de tamanhos e a pergunta sobre câmara fotográfica. O tamanho só é pedido na compra, salvo se a opção pedirTamanhoNoAluguer for ativada no código.

| Conta | Quando é pedida |
| --- | --- |
| Email Google | Todos; email real da conta usada no Drive, mesmo que coincida com o pessoal |
| Username GitHub | Infraestruturas Informáticas; nos restantes departamentos, se necessário |
| Email Figma | Infraestruturas Informáticas e Marketing; nos restantes, se necessário |
| Email Coda | Relações Externas; nos restantes, se necessário |
| Email Freedcamp | Marketing; nos restantes, se necessário |

Departamento é obrigatório. Qualquer departamento pode indicar outros serviços necessários através de perguntas Sim/Não; só nesse caso aparece o campo da conta. Cada conta é pedida uma vez por percurso. Não se inferem emails de outras contas a partir de campos vazios. Os acessos continuam sujeitos às políticas editáveis e à aprovação no Orbit; este script só recolhe dados.

## Executar na conta certa

1. Iniciar sessão no navegador com a conta Google que deve ser proprietária dos novos ficheiros. Essa conta precisa de acesso ao formulário usado como modelo em originalId.
2. Criar [um projeto Apps Script novo](https://script.google.com/home/projects/create), colar todo o [script](examples/orbit-member-form.gs), guardar e executar **criarFormularioBoasVindasNEI**.
3. Autorizar a execução e acompanhar os logs por etapa. O script só consulta o ficheiro original para o copiar; todas as alterações são feitas na cópia nova.
4. Abrir os links finais. Rever prazo, preços e guias herdados do modelo, percursos e perguntas antes de publicar. Uma nova execução cria outro formulário e outro Sheets; nada é eliminado ou substituído.

A cópia do Forms é partilhada para colaboração com a conta de serviço configurada em contaServico. O novo Sheets é partilhado apenas para leitura. O script não cria nem instala triggers de submissão.

## Configurar o Orbit depois da execução

O ID e os URLs só existem depois de os ficheiros serem criados. O resultado inclui editarFormulario, preencherFormulario, respostasNovas, respostasSheetId e configurarNoOrbitDepoisDeRever, com os valores reais de **ACCESS_FORMS_ID**, **ACCESS_FORMS_URL** e **ACCESS_FORMS_FIELDS**. O mapeamento cobre nome, email pessoal, telefone, departamento, Discord, GitHub, Google, Figma, Coda e Freedcamp. Usa títulos de perguntas e suporta as secções condicionais repetidas.

O novo Sheets é o destino das respostas deste Forms. A integração principal lê diretamente as respostas através da Forms API; não é preciso configurar esse Sheets como uma segunda origem nem normalizar colunas. **ACCESS_SHEETS_ID, ACCESS_SHEETS_RANGE e os mapeamentos atuais continuam a apontar para o registo manual Membros**, que serve de origem independente para onboarding e offboarding. Os seus cabeçalhos, incluindo Cargo e E-mail NEI, não são alterados pelo script.

No onboarding com uma resposta Forms sem Cargo, a UI seleciona Membro. Para offboarding, alterações de acesso ou transições Alumni, os responsáveis confirmam os cargos de origem no Orbit; não são inferidos a partir deste formulário de boas-vindas.

Validação local: node --test docs/examples/orbit-member-form.test.cjs. Os testes simulam 320 combinações de departamento, polo e acessos adicionais, verificam ausência de perguntas de cargo/email NEI, preservação do modelo e partilha/configuração só dos ficheiros novos. A execução na Google ainda é necessária para validar autorização, layout e publicação.

Referências: [Form](https://developers.google.com/apps-script/reference/forms/form), [navegação em listas](https://developers.google.com/apps-script/reference/forms/list-item), [navegação antes de page breaks](https://developers.google.com/apps-script/reference/forms/page-break-item).
