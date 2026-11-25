const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function example() {
  const items = [], properties = new Map(), rows = [], opened = [];
  let header;
  function item(type) {
    const result = { type, index: items.length, title: '', choices: [], next: null,
      setTitle(value) { this.title = value; return this; },
      setHelpText() { return this; }, setRequired() { return this; }, setValidation() { return this; },
      createChoice(value, target) { return {value, target}; },
      setChoices(choices) { this.choices = choices; return this; },
      setChoiceValues(values) { this.choices = values.map(value => ({value})); return this; },
      setGoToPage(target) { this.next = target; return this; },
    };
    items.push(result); return result;
  }
  const members = {setName() {return this;}, setFrozenRows() {}, getRange() {return {setValues(value) {header = value[0];},setNumberFormat() {}};},appendRow(row) {rows.push(row);}};
  const spreadsheet = {getId: () => 'NEW_SHEET',getUrl: () => 'new-sheet-url',getSheets: () => [members],getSheetByName: () => members};
  const form = {getId: () => 'NEW_FORM',getEditUrl: () => 'new-edit-url',getPublishedUrl: () => 'new-form-url',
    setDescription() {},setProgressBar() {},setCollectEmail() {},setConfirmationMessage() {},
    setDestination(_type,id) {assert.equal(id,'NEW_SHEET');},
    addTextItem: () => item('text'),addListItem: () => item('choice'),addPageBreakItem: () => item('page'),addSectionHeaderItem: () => item('heading'),
  };
  const context = vm.createContext({
    console: {log() {}},
    FormApp: {create(_title,published) {assert.equal(published,false);return form;},createTextValidation: () => ({requireTextIsEmail: () => ({build: () => ({})})}),DestinationType: {SPREADSHEET:'sheet'}},
    SpreadsheetApp: {create: () => spreadsheet,openById(id) {opened.push(id);assert.equal(id,'NEW_SHEET');return spreadsheet;}},
    PropertiesService: {getScriptProperties: () => ({getProperty: key => properties.get(key),setProperty(key,value) {properties.set(key,value);}})},
    ScriptApp: {newTrigger: () => ({forForm(created) {assert.equal(created,form);return this;},onFormSubmit() {return this;},create() {}})},
    LockService: {getScriptLock: () => ({waitLock() {},releaseLock() {}})},
  });
  vm.runInContext(fs.readFileSync(__dirname + '/orbit-member-form.gs','utf8'),context);
  context.createOrbitMemberExample();
  function response(values, source = 'NEW_FORM') {
    context.handleOrbitMemberExampleResponse({source:{getId: () => source},response:{getId: () => 'response-1',getItemResponses: () => Object.entries(values).map(([title,value]) => ({getResponse: () => value,getItem: () => ({getTitle: () => title})}))}});
  }
  function questions(role,department) {
    const result = [];
    let index = 0, guard = 0;
    while (index < items.length) {
      assert(guard++ < 100,'navigation loop');
      let target;
      while (index < items.length && items[index].type !== 'page') {
        const entry = items[index++];
        if (['text','choice'].includes(entry.type)) result.push(entry.title);
        if (entry.type === 'choice') target = entry.choices.find(choice => choice.value === (entry.title === 'Cargo' ? role : department))?.target;
      }
      if (target) index = target.index + 1;
      else if (items[index]?.next) index = items[index].next.index + 1;
      else index++;
    }
    return result;
  }
  return {context,response,questions,rows,opened,get header() {return header;}};
}

test('role and department branches ask only relevant accounts, once', () => {
  const form = example();
  for (const role of ['Membro','Coordenador','Co-coordenador','Direção','Presidência','Alumni']) {
    for (const department of ['Informática','Marketing','Relações Externas','Eventos','Direção']) {
      const fields = form.questions(role,department);
      assert.equal(fields.filter(field => field === 'Departamento').length,1);
      const active = role !== 'Alumni';
      assert.equal(fields.filter(field => field === 'Email Google').length,active ? 1 : 0);
      assert.equal(fields.filter(field => field === 'Username GitHub').length,active && (department === 'Informática' || role.includes('coordenador') || role === 'Coordenador') ? 1 : 0);
      assert.equal(fields.includes('Email Figma'),active && ['Informática','Marketing'].includes(department));
      assert.equal(fields.includes('Email Coda'),active && department === 'Relações Externas');
      assert.equal(fields.includes('Email Freedcamp'),active && department === 'Marketing');
    }
  }
});

test('new Membros keeps the original twelve headings and appends normal account fields', () => {
  const form = example();
  assert.deepEqual(Array.from(form.header),['Nome e Apelido','Nº Telemóvel','E-Mail Pessoal','Data de Nascimento','E-Mail ISEP','E-mail NEI','Ano','Departamento','Cargo','Título','ID Discord','Perfil LinkedIn ','Email Google','Username GitHub','Email Figma','Email Coda','Email Freedcamp']);
  form.response({'Nome e Apelido':'Pessoa','E-Mail Pessoal':'person@example.com','Nº Telemóvel':'+351900000000','Departamento':'Marketing','Cargo':'Membro','Username Discord':'person.name'});
  assert.equal(form.rows[0][10],"'@person.name");
  assert.equal(form.rows[0][12],'person@example.com');
  assert.equal(form.rows[0][14],'person@example.com');
  assert.equal(form.rows[0][15],'');
  assert.equal(form.rows[0][16],'person@example.com');
  assert.equal(form.rows[0][3],'');
  assert.deepEqual(form.opened,['NEW_SHEET']);
});

test('the response handler rejects other forms before opening any spreadsheet', () => {
  const form = example();
  assert.throws(() => form.response({},'ORIGINAL_FORM'),/not an example/);
  assert.deepEqual(form.opened,[]);
  form.response({'Nome e Apelido':'=formula','E-Mail Pessoal':'person@example.com','Departamento':'Eventos','Cargo':'Alumni'});
  form.response({'Nome e Apelido':'Duplicado'});
  assert.equal(form.rows.length,1);
  assert.equal(form.rows[0][0],"'=formula");
  assert.equal(form.rows[0][12],'');
});
