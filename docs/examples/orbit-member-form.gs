/**
 * Run createOrbitMemberExample in a NEW Apps Script project in your Google account.
 * Creates a private example Form and a NEW spreadsheet. No existing file IDs are used.
 * The Form is left unpublished for review. Do not attach this script to original files.
 */
function createOrbitMemberExample() {
  const form = FormApp.create('NEI — Dados de membro — Exemplo Orbit', false);
  form.setDescription('Exemplo separado dos registos oficiais. Indica dados normais da tua conta; nunca passwords, códigos MFA ou IDs técnicos. Só aparecem contas relevantes para o cargo/departamento.');
  form.setProgressBar(true);
  form.setCollectEmail(false);
  form.setConfirmationMessage('Dados recebidos. Os acessos continuam sujeitos a aprovação pelo NEI.');

  const emailValidation = FormApp.createTextValidation().requireTextIsEmail().build();
  function text(title, required, help, email) {
    const item = form.addTextItem().setTitle(title).setRequired(required);
    if (help) item.setHelpText(help);
    if (email) item.setValidation(emailValidation);
    return item;
  }
  const fallbackHelp = 'Se esta conta usa o mesmo E-Mail Pessoal indicado acima, deixa vazio. Ao deixar vazio confirmas que podemos usar esse email para este serviço. Se ainda não tens conta, cria-a primeiro ou pede ajuda ao responsável.';
  text('Nome e Apelido', true);
  text('Nº Telemóvel', true, 'Número com indicativo, por exemplo +351 9XXXXXXXX. Usado para os grupos WhatsApp aprovados.');
  text('E-Mail Pessoal', true, 'Email de contacto. Não é necessário usar a conta Google com que estás a responder.', true);
  text('Username Discord', false, 'Username exato em Definições da conta Discord, não o nome de apresentação. Exemplo: pessoa.nome. Não pedir nem copiar IDs. Entra no servidor NEI antes de o acesso ser executado.');
  const cargo = form.addListItem().setTitle('Cargo').setRequired(true);

  const pages = [];
  function page(title, terminal) {
    const item = form.addPageBreakItem().setTitle(title);
    pages.push({ item: item, terminal: Boolean(terminal) });
    return item;
  }
  function department() {
    return form.addListItem().setTitle('Departamento').setRequired(true)
      .setHelpText('Departamento principal neste registo. Outros vínculos são confirmados pelo operador no Orbit.');
  }
  function googleEmail() {
    text('Email Google', false, fallbackHelp + ' Esta deve ser a conta usada para o Google Drive.', true);
  }
  function githubUsername() {
    text('Username GitHub', false, 'Username da tua conta em github.com, por exemplo pessoa-github. Sem ID numérico. Se ainda não tens conta, cria-a primeiro ou pede ajuda ao responsável.');
  }

  const regular = page('Contas de membro');
  googleEmail();
  const regularDepartment = department();

  const coordination = page('Contas da Coordenação');
  googleEmail();
  githubUsername();
  text('E-mail NEI', false, 'Só se já tens uma caixa institucional ou foi pedida uma. Indica o endereço existente/pretendido; nunca a password.', true);
  const coordinationDepartment = department();

  const office = page('Contas da Direção / Presidência');
  googleEmail();
  text('E-mail NEI', false, 'Só se já tens uma caixa institucional ou foi pedida uma. Indica o endereço existente/pretendido; nunca a password.', true);
  const officeDepartment = department();

  const alumni = page('Contexto Alumni', true);
  const alumniDepartment = department();
  alumniDepartment.setChoiceValues(['Informática', 'Marketing', 'Relações Externas', 'Eventos', 'Direção']);

  const it = page('Informática — GitHub e Figma', true);
  githubUsername();
  text('Email Figma', false, fallbackHelp, true);

  const itCoordination = page('Informática — Figma', true);
  text('Email Figma', false, fallbackHelp, true);

  const marketing = page('Marketing — Figma e Freedcamp', true);
  text('Email Figma', false, fallbackHelp, true);
  text('Email Freedcamp', false, fallbackHelp, true);

  const external = page('Relações Externas — Coda', true);
  text('Email Coda', false, fallbackHelp, true);

  const finish = page('Concluir');
  form.addSectionHeaderItem().setTitle('Revê as contas antes de enviar')
    .setHelpText('Orbit confirma as contas e os acessos automáticos. Figma, Coda, Freedcamp, WhatsApp e cPanel são tratados pelos responsáveis após aprovação. Este formulário de exemplo não cria contas Orbit nem altera os registos originais.');

  cargo.setChoices([
    cargo.createChoice('Membro', regular),
    cargo.createChoice('Coordenador', coordination),
    cargo.createChoice('Co-coordenador', coordination),
    cargo.createChoice('Direção', office),
    cargo.createChoice('Presidência', office),
    cargo.createChoice('Alumni', alumni),
  ]);
  function routeDepartments(item, itPage) {
    item.setChoices([
      item.createChoice('Informática', itPage),
      item.createChoice('Marketing', marketing),
      item.createChoice('Relações Externas', external),
      item.createChoice('Eventos', finish),
      item.createChoice('Direção', finish),
    ]);
  }
  routeDepartments(regularDepartment, it);
  routeDepartments(officeDepartment, it);
  routeDepartments(coordinationDepartment, itCoordination);
  // A page break's navigation applies to the PRECEDING page, not its own page.
  pages.forEach(function (entry, index) {
    if (entry.terminal && pages[index + 1]) pages[index + 1].item.setGoToPage(finish);
  });

  const sheet = SpreadsheetApp.create('NEI — Membros — Exemplo Orbit');
  const members = sheet.getSheets()[0].setName('Membros');
  const headers = orbitMemberExampleHeaders();
  members.getRange(1, 1, 1, headers.length).setValues([headers]);
  members.setFrozenRows(1);
  // The twelve original headings remain in their original order. New fields are appended.
  members.getRange('A:Q').setNumberFormat('@');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
  PropertiesService.getScriptProperties().setProperty('orbit-example:' + form.getId(), sheet.getId());
  ScriptApp.newTrigger('handleOrbitMemberExampleResponse').forForm(form).onFormSubmit().create();
  console.log(JSON.stringify({ formEditUrl: form.getEditUrl(), formResponseUrl: form.getPublishedUrl(), sheetUrl: sheet.getUrl(), range: 'Membros!A1:Q5000', published: false }));
}

function orbitMemberExampleHeaders() {
  return ['Nome e Apelido', 'Nº Telemóvel', 'E-Mail Pessoal', 'Data de Nascimento', 'E-Mail ISEP', 'E-mail NEI', 'Ano', 'Departamento', 'Cargo', 'Título', 'ID Discord', 'Perfil LinkedIn ', 'Email Google', 'Username GitHub', 'Email Figma', 'Email Coda', 'Email Freedcamp'];
}

function handleOrbitMemberExampleResponse(event) {
  if (!event || !event.source || !event.response) throw new Error('Run only from the example Form submit trigger');
  const properties = PropertiesService.getScriptProperties();
  const sheetId = properties.getProperty('orbit-example:' + event.source.getId());
  if (!sheetId) throw new Error('Form is not an example created by this project');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const responseKey = 'orbit-example-response:' + event.response.getId();
    if (properties.getProperty(responseKey)) return;
    const answers = {};
    event.response.getItemResponses().forEach(function (response) {
      const value = String(response.getResponse() || '').trim();
      if (value) answers[response.getItem().getTitle()] = value;
    });
    const personal = answers['E-Mail Pessoal'] || '';
    const department = answers['Departamento'];
    answers['ID Discord'] = answers['Username Discord'] ? '@' + answers['Username Discord'].replace(/^@/, '') : '';
    if (answers['Cargo'] !== 'Alumni') answers['Email Google'] = answers['Email Google'] || personal;
    if (answers['Cargo'] !== 'Alumni' && ['Informática', 'Marketing'].indexOf(department) !== -1) answers['Email Figma'] = answers['Email Figma'] || personal;
    if (answers['Cargo'] !== 'Alumni' && department === 'Marketing') answers['Email Freedcamp'] = answers['Email Freedcamp'] || personal;
    if (answers['Cargo'] !== 'Alumni' && department === 'Relações Externas') answers['Email Coda'] = answers['Email Coda'] || personal;
    // Do not copy DOB, year or LinkedIn: they are unnecessary for access management.
    const row = orbitMemberExampleHeaders().map(function (header) {
      const value = answers[header] || '';
      // Keep all submitted values as text, including values beginning with formula characters.
      return /^[=+\-@]/.test(value) ? "'" + value : value;
    });
    const members = SpreadsheetApp.openById(sheetId).getSheetByName('Membros');
    if (!members) throw new Error('Example Membros sheet is missing');
    members.appendRow(row);
    properties.setProperty(responseKey, 'stored');
  } finally {
    lock.releaseLock();
  }
}
