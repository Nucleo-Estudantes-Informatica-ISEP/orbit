const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = __dirname + "/orbit-member-form.gs";
const sourceId = "10wGA0oMwNcSljhacF5P_9raxGAkXG3vbfsY0aR-cDFc";
const departments = [
  "Infraestruturas Informáticas",
  "Marketing",
  "Relações Externas",
  "Eventos",
  "Direção",
];
const sourceItems = [
  { type: "PAGE_BREAK", title: "IDENTIFICAÇÃO" },
  ...[
    "Nome completo",
    "Número Mecanográfico",
    "Email Institucional",
    "Email Pessoal",
    "Número de telemóvel",
    "Instagram Handle",
    "Discord Handle",
  ].map((title) => ({ type: "TEXT", title, required: true })),
  { type: "PAGE_BREAK", title: "POLOS DO NEI" },
  {
    type: "MULTIPLE_CHOICE",
    title: "Pretendes comprar o polo do NEI?",
    required: true,
    values: ["Pretendo comprar o polo", "Prentendo alugar o polo por evento"],
  },
  { type: "SECTION_HEADER", title: "Guia de tamanhos femininos" },
  { type: "SECTION_HEADER", title: "Guia de tamanhos masculinos" },
  {
    type: "MULTIPLE_CHOICE",
    title: "Seleciona o teu tamanho:",
    required: true,
    values: [
      "S - Feminino",
      "M - Feminino",
      "L - Feminino",
      "XL - Feminino",
      "XXL - Feminino",
      "3XL - Feminino",
      "S - Masculino",
      "M - Masculino",
      "L - Masculino",
      "XL - Masculino",
      "XXL - Masculino",
      "3XL - Masculino",
      "4XL - Masculino",
      "5XL - Masculino",
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    title: "Tens câmara fotográfica que possa ser usada em eventos do NEI?",
    required: true,
    values: ["Sim", "Não"],
  },
];
function create(options = {}) {
  const items = [],
    messages = [],
    editors = [],
    viewers = [],
    openedFiles = [];
  let published = true,
    accepting = true,
    detached = false,
    privateCopy = false,
    copies = 0,
    sheetCreated = false,
    indexReads = 0,
    destination = "ORIGINAL_SHEET";
  const sourceSnapshot = JSON.stringify(sourceItems);
  const choice = (value, target) => ({
    value,
    target,
    getValue() {
      return value;
    },
  });
  function item(type, def = {}) {
    const obj = {
      type,
      title: def.title || "",
      required: def.required || false,
      choices: (def.values || []).map((v) => choice(v)),
      goto: "CONTINUE",
      help: "",
      validation: null,
      getTitle() {
        return this.title;
      },
      getIndex() {
        indexReads++;
        return items.indexOf(this);
      },
      getType() {
        return this.type;
      },
      setTitle(v) {
        this.title = v;
        return this;
      },
      setRequired(v) {
        this.required = v;
        return this;
      },
      setHelpText(v) {
        this.help = v;
        return this;
      },
      setValidation(v) {
        this.validation = v;
        return this;
      },
      asTextItem() {
        assert.equal(this.type, "TEXT");
        return this;
      },
      asMultipleChoiceItem() {
        assert.equal(this.type, "MULTIPLE_CHOICE");
        return this;
      },
      asPageBreakItem() {
        assert.equal(this.type, "PAGE_BREAK");
        return this;
      },
      getChoices() {
        return this.choices;
      },
      createChoice(v, t) {
        return choice(v, t);
      },
      setChoices(v) {
        this.choices = v;
        return this;
      },
      setGoToPage(v) {
        this.goto = v;
        return this;
      },
    };
    items.push(obj);
    return obj;
  }
  sourceItems
    .filter((i) => i.title !== options.omitTitle)
    .forEach((i) => item(i.type, i));
  if (options.extraTemplateItem) item("TEXT", { title: "Cargo" });
  const form = {
    getId: () => "NEW_FORM",
    getEditUrl: () => "https://example.com/new-form/edit",
    getPublishedUrl: () => "https://example.com/new-form/viewform",
    supportsAdvancedResponderPermissions: () => !options.legacy,
    setPublished(v) {
      published = v;
    },
    setAcceptingResponses(v) {
      accepting = v;
    },
    removeDestination() {
      detached = true;
      destination = null;
    },
    getResponses: () => (options.newResponses ? [{}] : []),
    setProgressBar() {},
    setShuffleQuestions() {},
    setPublishingSummary() {},
    setConfirmationMessage() {},
    getItems(type) {
      return type ? items.filter((i) => i.type === type) : items.slice();
    },
    moveItem(entry, index) {
      const old = items.indexOf(entry);
      assert(old >= 0);
      items.splice(old, 1);
      items.splice(index, 0, entry);
      return entry;
    },
    addPageBreakItem: () => item("PAGE_BREAK"),
    addTextItem: () => item("TEXT"),
    addListItem: () => item("LIST"),
    addMultipleChoiceItem: () => item("MULTIPLE_CHOICE"),
    addSectionHeaderItem: () => item("SECTION_HEADER"),
    setDestination(type, id) {
      assert(detached);
      assert.equal(type, "SPREADSHEET");
      assert.equal(id, "NEW_SHEET");
      destination = id;
    },
    addEditor(email) {
      editors.push(email);
    },
  };
  const copyFile = {
    getId: () => (options.badCopyId ? sourceId : "NEW_FORM"),
    setSharing(access, permission) {
      assert.equal(access, "PRIVATE");
      assert.equal(permission, "NONE");
      privateCopy = true;
    },
  };
  const context = vm.createContext({
    console: {
      log(v) {
        messages.push(v);
      },
      error(v) {
        messages.push(v);
      },
    },
    Utilities: { formatDate: () => "2026-10-30 001000" },
    DriveApp: {
      Access: { PRIVATE: "PRIVATE" },
      Permission: { NONE: "NONE" },
      getRootFolder: () => "MY_ROOT",
      getFileById(id) {
        openedFiles.push(id);
        assert.equal(id, sourceId, "only the source template may be looked up");
        return {
          getName: () => "FORMULÁRIO DE BOAS VINDAS",
          makeCopy(name, folder) {
            copies++;
            assert(name.includes("boas-vindas membros"));
            assert.equal(folder, "MY_ROOT");
            return copyFile;
          },
        };
      },
    },
    FormApp: {
      ItemType: {
        PAGE_BREAK: "PAGE_BREAK",
        TEXT: "TEXT",
        MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
        SECTION_HEADER: "SECTION_HEADER",
        LIST: "LIST",
      },
      PageNavigationType: { CONTINUE: "CONTINUE" },
      DestinationType: { SPREADSHEET: "SPREADSHEET" },
      openById(id) {
        assert.equal(id, "NEW_FORM", "never open the original for mutation");
        return form;
      },
      createTextValidation() {
        return {
          requireTextIsEmail() {
            this.kind = "email";
            return this;
          },
          requireTextMatchesPattern(pattern) {
            this.kind = "pattern";
            this.pattern = pattern;
            return this;
          },
          build() {
            return { kind: this.kind, pattern: this.pattern };
          },
        };
      },
    },
    SpreadsheetApp: {
      create() {
        sheetCreated = true;
        assert(privateCopy);
        assert(options.legacy ? accepting === false : published === false);
        return {
          getId: () => "NEW_SHEET",
          getUrl: () => "https://example.com/new-sheet",
          addViewer(email) {
            viewers.push(email);
          },
        };
      },
    },
  });
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
  if (options.rentSize)
    vm.runInContext("NEI_NOVO_FORM.pedirTamanhoNoAluguer=true", context);
  let result, error;
  try {
    result = context.criarFormularioBoasVindasNEI();
  } catch (e) {
    error = e;
  }
  assert.equal(JSON.stringify(sourceItems), sourceSnapshot);
  const calls = indexReads;
  function simulate(department, buy, mask) {
    let index = 0,
      guard = 0;
    const questions = [];
    const gates = {
      "Precisas de indicar uma conta Google usada no NEI?": 0,
      "Vais usar o GitHub do NEI?": 1,
      "Vais usar o Figma do NEI?": 2,
      "Vais usar o Coda do NEI?": 3,
      "Vais usar o Freedcamp do NEI?": 4,
    };
    while (index < items.length) {
      assert(guard++ < 100, "navigation must terminate");
      let target = null;
      while (index < items.length && items[index].type !== "PAGE_BREAK") {
        const entry = items[index++];
        if (["TEXT", "LIST", "MULTIPLE_CHOICE"].includes(entry.type))
          questions.push(entry.title);
        if (entry.choices.length) {
          let value = entry.choices[0].value;
          if (entry.title === "Departamento") value = department;
          else if (entry.title === "Pretendes comprar o polo do NEI?")
            value = buy
              ? "Pretendo comprar o polo"
              : "Prentendo alugar o polo por evento";
          else if (entry.title in gates)
            value = mask & (1 << gates[entry.title]) ? "Sim" : "Não";
          const selected = entry.choices.find((c) => c.value === value);
          assert(selected);
          if (selected.target) target = selected.target;
        }
      }
      if (index === items.length) break;
      target = target || items[index].goto;
      index =
        target && target !== "CONTINUE" ? target.getIndex() + 1 : index + 1;
    }
    return questions;
  }
  return {
    items,
    openedFiles,
    messages,
    editors,
    viewers,
    result,
    error,
    simulate,
    calls,
    copies,
    destination,
    published,
    accepting,
    sheetCreated,
  };
}
test("all 320 department/polo/additional-service routes collect normal member data with no role or NEI mailbox question", () => {
  const f = create();
  assert.ifError(f.error);
  let routes = 0;
  const fields = [
    "Email Google",
    "Username GitHub",
    "Email Figma",
    "Email Coda",
    "Email Freedcamp",
  ];
  assert(
    !f.items.some((i) =>
      /cargo|alumni|presidência|coordenador/i.test(i.title + " " + i.help),
    ),
  );
  assert(
    !f.items.some((i) =>
      /e[ -]?mail (?:do )?NEI|caixa de email/i.test(i.title + " " + i.help),
    ),
  );
  assert(
    !f.items.some((i) =>
      i.choices.some((c) =>
        [
          "Membro",
          "Presidência",
          "Alumni",
          "Coordenador",
          "Co-coordenador",
        ].includes(c.value),
      ),
    ),
  );
  for (const dep of departments)
    for (const buy of [true, false])
      for (let mask = 0; mask < 32; mask++) {
        const expected = [
          true,
          dep === "Infraestruturas Informáticas",
          dep === "Infraestruturas Informáticas" || dep === "Marketing",
          dep === "Relações Externas",
          dep === "Marketing",
        ];
        const q = f.simulate(dep, buy, mask);
        assert.equal(q.filter((v) => v === "Departamento").length, 1);
        assert(!q.includes("Cargo"));
        assert.equal(
          q.filter((v) => v === "Seleciona o teu tamanho:").length,
          buy ? 1 : 0,
        );
        for (let i = 0; i < fields.length; i++)
          assert.equal(
            q.filter((v) => v === fields[i]).length,
            expected[i] || mask & (1 << i) ? 1 : 0,
            JSON.stringify({ dep, buy, mask, field: fields[i] }),
          );
        for (const title of [
          "Nome completo",
          "Número Mecanográfico",
          "Email Institucional",
          "Email Pessoal",
          "Número de telemóvel",
          "Instagram Handle",
          "Discord Handle",
          "Pretendes comprar o polo do NEI?",
          "Tens câmara fotográfica que possa ser usada em eventos do NEI?",
        ])
          assert.equal(q.filter((v) => v === title).length, 1);
        routes++;
      }
  assert.equal(routes, 320);
  console.log(
    JSON.stringify({
      routes,
      sections: f.items.filter((i) => i.type === "PAGE_BREAK").length,
      items: f.items.length,
      indexReads: f.calls,
    }),
  );
});
test("creates only a new closed copy and linked response sheet, with complete future configuration", () => {
  const f = create();
  assert.ifError(f.error);
  assert.deepEqual(f.openedFiles, [sourceId]);
  assert.equal(f.copies, 1);
  assert.equal(f.destination, "NEW_SHEET");
  assert.equal(f.result.respostasSheetId, "NEW_SHEET");
  const vars = f.result.configurarNoOrbitDepoisDeRever;
  assert.equal(vars.ACCESS_FORMS_ID, "NEW_FORM");
  assert.equal(vars.ACCESS_FORMS_URL, "https://example.com/new-form/viewform");
  assert.deepEqual(JSON.parse(vars.ACCESS_FORMS_FIELDS), {
    name: "Nome completo",
    email: "Email Pessoal",
    phone: "Número de telemóvel",
    departments: "Departamento",
    discordUsername: "Discord Handle",
    githubUsername: "Username GitHub",
    googleEmail: "Email Google",
    figmaEmail: "Email Figma",
    codaEmail: "Email Coda",
    freedcampEmail: "Email Freedcamp",
  });
  assert(!("ACCESS_SHEETS_ID" in vars));
  assert.equal(f.published, false);
  assert.deepEqual(f.editors, [
    "orbit-access@onboarding-offboarding-506017.iam.gserviceaccount.com",
  ]);
  assert.deepEqual(f.viewers, f.editors);
  assert(f.calls < 100);
  assert(f.messages.length >= 10);
});
test("preserves original questions and clothing options, with optional Instagram and configurable rental size", () => {
  const f = create({ rentSize: true });
  assert.ifError(f.error);
  assert(f.simulate("Eventos", false, 0).includes("Seleciona o teu tamanho:"));
  assert.equal(
    f.items.find((i) => i.title === "Instagram Handle").required,
    false,
  );
  assert.deepEqual(
    f.items
      .find((i) => i.title === "Seleciona o teu tamanho:")
      .choices.map((c) => c.value),
    sourceItems.find((i) => i.title === "Seleciona o teu tamanho:").values,
  );
});
test("fails closed on unexpected template, nonempty new copy, or source returned as copy", () => {
  for (const opts of [
    { omitTitle: "Discord Handle" },
    { newResponses: true },
    { badCopyId: true },
    { extraTemplateItem: true },
  ]) {
    const f = create(opts);
    assert(f.error);
    assert.equal(f.sheetCreated, false);
  }
});
test("legacy forms stay closed to responses", () => {
  const f = create({ legacy: true });
  assert.ifError(f.error);
  assert.equal(f.accepting, false);
});
