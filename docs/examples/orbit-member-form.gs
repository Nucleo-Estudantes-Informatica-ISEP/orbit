/**
 * BOAS-VINDAS NEI — CRIAR APENAS FICHEIROS NOVOS
 *
 * Colar num projeto Apps Script novo e executar criarFormularioBoasVindasNEI().
 * Usar a conta Google que deve ser proprietária do formulário e do Sheets.
 * Essa conta precisa de acesso ao modelo indicado em originalId.
 *
 * Cria uma cópia do modelo e um Sheets novo ligado às suas respostas.
 * Não elimina ficheiros, não procura cópias anteriores e não altera originais.
 * O formulário fica fechado para revisão. Cada execução cria outra cópia.
 * Mantém os títulos do modelo; rever prazo, preços e guias herdados na cópia.
 * Todos são novos membros: não há pergunta de cargo nem de email institucional
 * NEI. A criação de caixas é uma tarefa manual interna no Orbit.
 * As condições dependem do departamento e dos acessos adicionais necessários.
 * Não recolhe passwords, tokens ou IDs técnicos nem concede permissões.
 * Partilha só os ficheiros novos com a conta de serviço configurada.
 * No fim mostra os links e ACCESS_FORMS_ID/URL/FIELDS para configurar o Orbit.
 * O registo manual Membros continua uma origem independente.
 */
const NEI_NOVO_FORM = {
  originalId: "10wGA0oMwNcSljhacF5P_9raxGAkXG3vbfsY0aR-cDFc",
  contaServico:
    "orbit-access@onboarding-offboarding-506017.iam.gserviceaccount.com",
  pedirTamanhoNoAluguer: false,
  instagramOpcional: true,
  departamentos: [
    "Infraestruturas Informáticas",
    "Marketing",
    "Relações Externas",
    "Eventos",
    "Direção",
  ],
};

function criarFormularioBoasVindasNEI() {
  const cfg = NEI_NOVO_FORM;
  console.log("A criar o formulário novo de boas-vindas para membros.");
  const ficheiroOriginal = DriveApp.getFileById(cfg.originalId);
  const data = Utilities.formatDate(
    new Date(),
    "Europe/Lisbon",
    "yyyy-MM-dd HHmmss",
  );
  const copia = ficheiroOriginal.makeCopy(
    ficheiroOriginal.getName() + " — boas-vindas membros — " + data,
    DriveApp.getRootFolder(),
  );
  if (copia.getId() === cfg.originalId)
    throw new Error("A cópia não tem um ID novo. Operação interrompida.");
  return prepararFormularioNEI_(copia, data);
}

function prepararFormularioNEI_(copia, data) {
  const cfg = NEI_NOVO_FORM;
  const inicio = Date.now();
  function progresso(mensagem) {
    console.log(
      "[" + Math.round((Date.now() - inicio) / 1000) + "s] " + mensagem,
    );
  }
  if (copia.getId() === cfg.originalId)
    throw new Error("Nunca configurar o original.");
  const form = FormApp.openById(copia.getId());
  if (form.getId() !== copia.getId())
    throw new Error("Formulário inesperado. Operação interrompida.");
  const suportaPublicacao = form.supportsAdvancedResponderPermissions();
  if (suportaPublicacao) form.setPublished(false);
  else form.setAcceptingResponses(false);
  form.removeDestination();
  copia.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  progresso("Cópia nova, ainda fechada: " + form.getEditUrl());

  try {
    if (form.getResponses().length !== 0)
      throw new Error(
        "A cópia já contém respostas; rever manualmente antes de continuar.",
      );
    const elementos = form.getItems().map(function (item) {
      return { item: item, title: item.getTitle(), type: item.getType() };
    });
    if (elementos.length !== 14)
      throw new Error(
        "O modelo mudou; rever as perguntas na cópia antes de continuar.",
      );
    const porTitulo = Object.create(null);
    elementos.forEach(function (entry) {
      if (!porTitulo[entry.title]) porTitulo[entry.title] = [];
      porTitulo[entry.title].push(entry);
    });
    function encontrar(titulo) {
      const encontrados = porTitulo[titulo] || [];
      if (encontrados.length !== 1)
        throw new Error(
          "Esperava uma pergunta/elemento com o título: " + titulo,
        );
      return encontrados[0].item;
    }
    // Validar as perguntas herdadas antes de acrescentar as condições.
    const modelo = [
      ["IDENTIFICAÇÃO", "PAGE_BREAK"],
      ["Nome completo", "TEXT"],
      ["Número Mecanográfico", "TEXT"],
      ["Email Institucional", "TEXT"],
      ["Email Pessoal", "TEXT"],
      ["Número de telemóvel", "TEXT"],
      ["Instagram Handle", "TEXT"],
      ["Discord Handle", "TEXT"],
      ["POLOS DO NEI", "PAGE_BREAK"],
      ["Pretendes comprar o polo do NEI?", "MULTIPLE_CHOICE"],
      ["Guia de tamanhos femininos", "SECTION_HEADER"],
      ["Guia de tamanhos masculinos", "SECTION_HEADER"],
      ["Seleciona o teu tamanho:", "MULTIPLE_CHOICE"],
      [
        "Tens câmara fotográfica que possa ser usada em eventos do NEI?",
        "MULTIPLE_CHOICE",
      ],
    ];
    modelo.forEach(function (entry) {
      encontrar(entry[0]);
      if (porTitulo[entry[0]][0].type !== FormApp.ItemType[entry[1]])
        throw new Error("Tipo inesperado no modelo: " + entry[0]);
    });
    progresso("1/7 — Modelo validado.");

    progresso("2/7 — A configurar os dados pessoais.");
    form.setProgressBar(true);
    form.setShuffleQuestions(false);
    form.setPublishingSummary(false);
    form.setConfirmationMessage(
      "Obrigado! Os dados foram recebidos. Os responsáveis do NEI confirmarão os acessos necessários.",
    );

    const validacaoEmail = FormApp.createTextValidation()
      .requireTextIsEmail()
      .build();
    encontrar("Email Pessoal").asTextItem().setValidation(validacaoEmail);
    encontrar("Email Institucional")
      .asTextItem()
      .setValidation(validacaoEmail)
      .setHelpText("Email institucional do ISEP.");
    encontrar("Número de telemóvel")
      .asTextItem()
      .setHelpText(
        "Número com indicativo, por exemplo +351 9XXXXXXXX. Usado para os grupos WhatsApp do NEI.",
      )
      .setValidation(
        FormApp.createTextValidation()
          .requireTextMatchesPattern("^\\+?[0-9 ()-]{7,25}$")
          .build(),
      );
    encontrar("Discord Handle")
      .asTextItem()
      .setHelpText(
        "Username exato da conta Discord, não o nome de apresentação nem um ID numérico. Ex.: pessoa.nome. Entra no servidor do NEI antes de serem configurados os acessos.",
      )
      .setValidation(
        FormApp.createTextValidation()
          .requireTextMatchesPattern("^@?[A-Za-z0-9_.]{2,32}(#[0-9]{4})?$")
          .build(),
      );
    if (cfg.instagramOpcional)
      encontrar("Instagram Handle")
        .asTextItem()
        .setRequired(false)
        .setHelpText(
          "Opcional. Se tens Instagram e queres partilhar o conteúdo do núcleo, indica o teu username.",
        );

    // Navegação só na cópia; evita que uma configuração antiga termine o formulário cedo.
    form.getItems(FormApp.ItemType.PAGE_BREAK).forEach(function (item) {
      item.asPageBreakItem().setGoToPage(FormApp.PageNavigationType.CONTINUE);
    });

    const paginas = [];
    function pagina(titulo, ajuda) {
      const item = form.addPageBreakItem().setTitle(titulo);
      if (ajuda) item.setHelpText(ajuda);
      return item;
    }
    function continuar(origem, destino) {
      paginas.push({ origem: origem, destino: destino });
    }
    function texto(titulo, ajuda, tipo) {
      const item = form
        .addTextItem()
        .setTitle(titulo)
        .setRequired(true)
        .setHelpText(ajuda);
      if (tipo === "email") item.setValidation(validacaoEmail);
      if (tipo === "github")
        item.setValidation(
          FormApp.createTextValidation()
            .requireTextMatchesPattern(
              "^@?[A-Za-z0-9]([A-Za-z0-9-]{0,37}[A-Za-z0-9])?$",
            )
            .build(),
        );
      return item;
    }
    function moverParaFim(item) {
      form.moveItem(item, form.getItems().length - 1);
    }

    progresso("3/7 — A configurar polo e departamento.");
    // Preservar guias/opções de tamanhos e a pergunta da câmara, mudando apenas o percurso.
    const polo = encontrar(
      "Pretendes comprar o polo do NEI?",
    ).asMultipleChoiceItem();
    const opcoesPolo = polo.getChoices().map(function (choice) {
      return choice.getValue();
    });
    const compra = opcoesPolo.filter(function (value) {
      return /comprar/i.test(value);
    });
    const aluguer = opcoesPolo.filter(function (value) {
      return /alugar/i.test(value);
    });
    if (opcoesPolo.length !== 2 || compra.length !== 1 || aluguer.length !== 1)
      throw new Error(
        "As opções do polo mudaram; rever as condições na cópia.",
      );
    const guiaF = encontrar("Guia de tamanhos femininos");
    const guiaM = encontrar("Guia de tamanhos masculinos");
    const tamanho = encontrar("Seleciona o teu tamanho:");
    const camara = encontrar(
      "Tens câmara fotográfica que possa ser usada em eventos do NEI?",
    );
    const paginaTamanho = pagina("TAMANHO DO POLO");
    [guiaF, guiaM, tamanho].forEach(moverParaFim);
    const paginaCamara = pagina("COLABORAÇÃO EM EVENTOS");
    moverParaFim(camara);
    polo.setChoices([
      polo.createChoice(compra[0], paginaTamanho),
      polo.createChoice(
        aluguer[0],
        cfg.pedirTamanhoNoAluguer ? paginaTamanho : paginaCamara,
      ),
    ]);
    continuar(paginaTamanho, paginaCamara);

    const paginaDepartamento = pagina(
      "DEPARTAMENTO",
      "Indica o departamento em que estás a entrar no NEI.",
    );
    const departamento = form
      .addListItem()
      .setTitle("Departamento")
      .setRequired(true)
      .setHelpText(
        "Departamento principal. Vínculos adicionais são confirmados pelos responsáveis no Orbit.",
      );
    continuar(paginaCamara, paginaDepartamento);

    const servicos = [
      {
        key: "google",
        title: "Email Google",
        kind: "email",
        gate: "Precisas de indicar uma conta Google usada no NEI?",
        help: "Email da conta Google usada para aceder ao Drive. Não precisa terminar em gmail.com. Se é o teu Email Pessoal, escreve esse mesmo endereço.",
      },
      {
        key: "github",
        title: "Username GitHub",
        kind: "github",
        gate: "Vais usar o GitHub do NEI?",
        help: "Username da tua conta em github.com, por exemplo pessoa-github. Sem URL nem ID numérico. Se ainda não tens conta e este acesso é necessário, cria-a ou pede ajuda ao responsável.",
      },
      {
        key: "figma",
        title: "Email Figma",
        kind: "email",
        gate: "Vais usar o Figma do NEI?",
        help: "Email usado na tua conta Figma, para receber o convite para a team. Se coincide com o Email Pessoal, escreve o mesmo endereço.",
      },
      {
        key: "coda",
        title: "Email Coda",
        kind: "email",
        gate: "Vais usar o Coda do NEI?",
        help: "Email que deve receber o convite para a team Coda. Se coincide com o Email Pessoal, escreve o mesmo endereço.",
      },
      {
        key: "freedcamp",
        title: "Email Freedcamp",
        kind: "email",
        gate: "Vais usar o Freedcamp do NEI?",
        help: "Email que deve receber o convite para a team Freedcamp. Se coincide com o Email Pessoal, escreve o mesmo endereço.",
      },
    ];

    function recomendados(dep) {
      const usados = ["google"];
      if (dep === "Infraestruturas Informáticas") usados.push("github");
      if (dep === "Infraestruturas Informáticas" || dep === "Marketing")
        usados.push("figma");
      if (dep === "Relações Externas") usados.push("coda");
      if (dep === "Marketing") usados.push("freedcamp");
      return usados;
    }

    // Grafo sem ciclos: cada serviço é tratado uma vez, incluindo acessos extra.
    // Partilhar os sufixos mantém o formulário pequeno e evita perguntas repetidas.
    const estados = {};
    const fim = { key: "fim", page: null };
    function caminho(indice, obrigatorios) {
      if (indice >= servicos.length) return fim;
      const servico = servicos[indice];
      const posteriores = obrigatorios.filter(function (key) {
        return (
          servicos.findIndex(function (entry) {
            return entry.key === key;
          }) > indice
        );
      });
      const seguinte = caminho(indice + 1, posteriores);
      const sufixo = indice + ":" + posteriores.join(",");
      const chaveConta = "conta:" + sufixo;
      if (!estados[chaveConta])
        estados[chaveConta] = {
          key: chaveConta,
          index: indice,
          kind: "conta",
          service: servico,
          next: seguinte,
          page: null,
        };
      if (obrigatorios.indexOf(servico.key) !== -1) return estados[chaveConta];
      const chavePergunta = "pergunta:" + sufixo;
      if (!estados[chavePergunta])
        estados[chavePergunta] = {
          key: chavePergunta,
          index: indice,
          kind: "pergunta",
          service: servico,
          yes: estados[chaveConta],
          next: seguinte,
          page: null,
        };
      return estados[chavePergunta];
    }

    // Todos entram como membros. Cada departamento aponta diretamente para
    // a recolha das contas necessárias, sem pergunta nem secção de cargo.
    const entradasDepartamento = {};
    cfg.departamentos.forEach(function (dep) {
      entradasDepartamento[dep] = caminho(0, recomendados(dep));
    });

    const todosEstados = Object.keys(estados).map(function (key) {
      return estados[key];
    });
    todosEstados.sort(function (a, b) {
      return (
        a.index - b.index ||
        (a.kind === b.kind
          ? a.key.localeCompare(b.key)
          : a.kind === "pergunta"
            ? -1
            : 1)
      );
    });
    progresso(
      "4/7 — A criar " +
        todosEstados.length +
        " secções condicionais de contas.",
    );
    todosEstados.forEach(function (estado, index) {
      estado.page = pagina(
        estado.kind === "pergunta"
          ? "OUTROS ACESSOS — " + estado.service.title
          : "CONTA — " + estado.service.title,
      );
      if (estado.kind === "pergunta") {
        estado.question = form
          .addMultipleChoiceItem()
          .setTitle(estado.service.gate)
          .setRequired(true)
          .setHelpText(
            "Seleciona Sim apenas se precisas deste serviço ou se foi pedido pelo responsável. Qualquer departamento pode solicitar estes acessos; a autorização é confirmada no Orbit.",
          );
      } else
        texto(estado.service.title, estado.service.help, estado.service.kind);
      if ((index + 1) % 5 === 0 || index === todosEstados.length - 1) {
        progresso(
          "Secções de contas: " + (index + 1) + "/" + todosEstados.length + ".",
        );
      }
    });

    fim.page = pagina("CONCLUIR");
    form
      .addSectionHeaderItem()
      .setTitle("Obrigado por preencheres!")
      .setHelpText(
        "Confirma os teus dados antes de enviar. Os responsáveis validam os acessos. As contas indicadas não concedem permissões por si só.",
      );

    progresso("5/7 — A ligar os percursos condicionais.");
    departamento.setChoices(
      cfg.departamentos.map(function (dep) {
        return departamento.createChoice(dep, entradasDepartamento[dep].page);
      }),
    );
    continuar(paginaDepartamento, fim.page);
    todosEstados.forEach(function (estado) {
      if (estado.kind === "pergunta")
        estado.question.setChoices([
          estado.question.createChoice("Sim", estado.yes.page),
          estado.question.createChoice("Não", estado.next.page),
        ]);
      continuar(estado.page, estado.next.page);
    });

    // setGoToPage aplica-se à secção ANTERIOR à quebra, não à secção que ela inicia.
    // Cada getIndex() pode consultar o Forms. Ler uma vez por quebra/rota,
    // nunca dentro da procura: a versão anterior fazia milhares de chamadas.
    const quebras = form
      .getItems(FormApp.ItemType.PAGE_BREAK)
      .map(function (item) {
        return { item: item, index: item.getIndex() };
      });
    paginas.forEach(function (rota, index) {
      const inicioSecao = rota.origem.getIndex();
      const limite = quebras.find(function (entry) {
        return entry.index > inicioSecao;
      });
      if (!limite)
        throw new Error(
          "Não existe uma quebra para terminar a secção: " +
            rota.origem.getTitle(),
        );
      limite.item.asPageBreakItem().setGoToPage(rota.destino);
      if ((index + 1) % 10 === 0)
        progresso(
          "Percursos ligados: " + (index + 1) + "/" + paginas.length + ".",
        );
    });

    progresso("6/7 — A criar o novo Sheets de respostas.");
    const sheet = SpreadsheetApp.create(
      "Respostas — Boas-vindas NEI — " + data,
    );
    form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
    progresso("7/7 — A partilhar os ficheiros novos com a conta de serviço.");
    if (cfg.contaServico) {
      form.addEditor(cfg.contaServico);
      sheet.addViewer(cfg.contaServico);
    }

    const resultado = {
      editarFormulario: form.getEditUrl(),
      preencherFormulario: form.getPublishedUrl(),
      respostasNovas: sheet.getUrl(),
      respostasSheetId: sheet.getId(),
      estado: suportaPublicacao ? "Não publicado" : "Fechado a respostas",
      contaServico: cfg.contaServico,
      configurarNoOrbitDepoisDeRever: {
        ACCESS_FORMS_ID: form.getId(),
        ACCESS_FORMS_URL: form.getPublishedUrl(),
        ACCESS_FORMS_FIELDS: JSON.stringify({
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
        }),
      },
      nota: "Boas-vindas para novos membros, sem recolha de cargo. Manter ACCESS_SHEETS_ID e ACCESS_SHEETS_RANGE do registo manual de Membros. Este novo Sheets é apenas o destino das respostas deste novo Forms.",
    };
    progresso(
      "Concluído. A cópia continua fechada para revisão; links e configuração abaixo.",
    );
    console.log(JSON.stringify(resultado, null, 2));
    return resultado;
  } catch (error) {
    console.error(
      "Operação interrompida. A cópia nova permanece por rever: " +
        form.getEditUrl(),
    );
    throw error;
  }
}
