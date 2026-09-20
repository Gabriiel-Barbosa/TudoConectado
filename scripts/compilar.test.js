import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { compilarGrafo, compilarCapitulos, compilarFio } from "./compilar.js";

describe("compilarGrafo", () => {
  const registros = [{ id: "moises", tipo: "pessoa", nome: "Moisés", descricao: "d" }];
  const afirmacoes = [{ id: "af-1", texto: "t", datacao: [] }];
  const passagens = [
    {
      id: "gen-01",
      referencia: "Gênesis 1",
      registros_citados: ["moises"],
      afirmacoes_citadas: ["af-1"],
    },
  ];
  const ligacoes = [
    {
      id: "lig-1",
      tipo: "confirma",
      entre: [{ registro: "moises" }, { afirmacao: "af-1" }],
      evidencia: { forca: "bem_estabelecido" },
      fontes: [{ nivel: 1, descricao: "x" }],
      o_que_derrubaria: "nada",
    },
  ];

  test("gera um nó por registro, afirmação e passagem", () => {
    const { nos } = compilarGrafo(registros, afirmacoes, passagens, []);
    assert.equal(nos.length, 3);
    assert.deepEqual(
      nos.map((n) => n.tipo).sort(),
      ["afirmacao", "passagem", "registro"]
    );
  });

  test("gera uma aresta por ligação, com origem/destino extraídos de 'entre'", () => {
    const { arestas } = compilarGrafo(registros, afirmacoes, passagens, ligacoes);
    const arestaLigacao = arestas.find((a) => a.ligacao === "lig-1");
    assert.ok(arestaLigacao);
    assert.equal(arestaLigacao.origem, "moises");
    assert.equal(arestaLigacao.destino, "af-1");
    assert.equal(arestaLigacao.forca, "bem_estabelecido");
  });

  test("a aresta de ligação carrega tipo_de_apoio, quem_sustenta e notas", () => {
    const comEvidenciaCompleta = [
      {
        id: "lig-2",
        tipo: "confirma",
        entre: [{ registro: "moises" }, { afirmacao: "af-1" }],
        evidencia: {
          tipo_de_apoio: "achado_arqueologico",
          forca: "bem_estabelecido",
          quem_sustenta: [{ nome: "Fulana", ano: 2012 }],
        },
        fontes: [{ nivel: 1, descricao: "x" }],
        o_que_derrubaria: "nada",
        notas: "o que isso não demonstra",
      },
    ];
    const { arestas } = compilarGrafo(registros, afirmacoes, [], comEvidenciaCompleta);
    const aresta = arestas.find((a) => a.ligacao === "lig-2");
    assert.equal(aresta.tipo_de_apoio, "achado_arqueologico");
    assert.deepEqual(aresta.quem_sustenta, [{ nome: "Fulana", ano: 2012 }]);
    assert.equal(aresta.notas, "o que isso não demonstra");
  });

  test("ligação sem tipo_de_apoio/quem_sustenta/notas não quebra a compilação", () => {
    const { arestas } = compilarGrafo(registros, afirmacoes, [], ligacoes);
    const aresta = arestas.find((a) => a.ligacao === "lig-1");
    assert.equal(aresta.tipo_de_apoio, null);
    assert.deepEqual(aresta.quem_sustenta, []);
    assert.equal(aresta.notas, null);
  });

  test("justificativa_copia só aparece na aresta quando existe na ligação", () => {
    const copia = [
      {
        id: "lig-copia",
        tipo: "foi_copiado_de",
        entre: [{ registro: "a" }, { registro: "b" }],
        evidencia: { tipo_de_apoio: "texto", forca: "disputado", quem_sustenta: [] },
        fontes: [{ nivel: 2, descricao: "x" }],
        o_que_derrubaria: "nada",
        justificativa_copia: {
          semelhanca_especifica: "s",
          anterioridade_comprovada: "a",
          caminho_plausivel: "c",
        },
      },
    ];
    const { arestas } = compilarGrafo([], [], [], copia);
    assert.equal(arestas[0].justificativa_copia.semelhanca_especifica, "s");

    const { arestas: semCopia } = compilarGrafo(registros, afirmacoes, [], ligacoes);
    assert.ok(!("justificativa_copia" in semCopia.find((a) => a.ligacao === "lig-1")));
  });

  test("uma ligação com 3+ pontas em 'entre' vira uma cadeia de arestas", () => {
    const ligacaoTripla = [
      {
        id: "lig-tripla",
        tipo: "confirma",
        entre: [{ registro: "a" }, { registro: "b" }, { registro: "c" }],
        evidencia: { forca: "disputado" },
        fontes: [{ nivel: 2, descricao: "x" }],
        o_que_derrubaria: "nada",
      },
    ];
    const { arestas } = compilarGrafo([], [], [], ligacaoTripla);
    assert.equal(arestas.length, 2);
    assert.deepEqual(
      arestas.map((a) => [a.origem, a.destino]),
      [
        ["a", "b"],
        ["b", "c"],
      ]
    );
  });

  test("passagem gera arestas 'cita' para registros_citados e afirmacoes_citadas", () => {
    const { arestas } = compilarGrafo(registros, afirmacoes, passagens, []);
    const citas = arestas.filter((a) => a.tipo === "cita");
    assert.equal(citas.length, 2);
    assert.ok(citas.some((a) => a.origem === "gen-01" && a.destino === "moises"));
    assert.ok(citas.some((a) => a.origem === "gen-01" && a.destino === "af-1"));
  });

  test("afirmação gera arestas 'envolve' para registros_envolvidos, mesmo sem nenhuma ligação as conectar", () => {
    const afirmacoesComEnvolvidos = [{ id: "af-1", texto: "t", datacao: [], registros_envolvidos: ["moises"] }];
    const { arestas } = compilarGrafo(registros, afirmacoesComEnvolvidos, [], []);
    const envolve = arestas.filter((a) => a.tipo === "envolve");
    assert.equal(envolve.length, 1);
    assert.equal(envolve[0].origem, "af-1");
    assert.equal(envolve[0].destino, "moises");
  });
});

describe("compilarFio", () => {
  const registros = [
    { id: "genesis", tipo: "texto", nome: "Gênesis", descricao: "d", total_capitulos: 50 },
    { id: "planck", tipo: "acontecimento", nome: "Planck", descricao: "d" },
  ];
  const textos = [
    { id: "genesis-01", livro: "Gênesis", capitulo: 1, versiculos: [] },
    { id: "genesis-02", livro: "Gênesis", capitulo: 2, versiculos: [] },
  ];
  const passagens = [
    {
      id: "gen-02",
      texto: "genesis-02",
      referencia: "Gênesis 2:1",
      titulo: "O jardim",
      afirma: ["resumo do dois"],
      conexoes: [],
    },
    {
      id: "gen-01",
      texto: "genesis-01",
      referencia: "Gênesis 1:1",
      titulo: "A criação",
      afirma: ["resumo do um", "segunda frase"],
      conexoes: [
        { ligacao: "planck-confirma-idade", versiculos: [1, 1], tema: "ciencia" },
        { ligacao: "enuma-paralelo", versiculos: [2, 2], tema: "paralelo" },
        { ligacao: "catecismo-confirma", versiculos: [5, 5], tema: "leitura_nao_literal" },
        { ligacao: "pca-confirma", versiculos: [5, 5], tema: "leitura_literal" },
      ],
    },
  ];
  const ligacoes = [
    { id: "planck-confirma-idade", entre: [{ registro: "planck" }, { afirmacao: "idade-do-universo" }] },
    { id: "enuma-paralelo", entre: [{ registro: "enuma" }, { registro: "genesis" }] },
    { id: "catecismo-confirma", entre: [{ registro: "catecismo" }, { afirmacao: "dias-nao-literais" }] },
    { id: "pca-confirma", entre: [{ registro: "pca" }, { afirmacao: "dias-nao-literais" }] },
  ];
  const afirmacoes = [
    { id: "idade-do-universo", texto: "13,8 bilhões", registros_envolvidos: ["planck"], datacao: [{ periodo: [-13820000000, -13774000000], segundo_quem: "Planck" }] },
    { id: "autoria-mosaica", texto: "Moisés escreveu", registros_envolvidos: ["genesis"], datacao: [{ periodo: [-1446, -1200], segundo_quem: "tradição" }] },
    { id: "pentateuco-persa", texto: "período persa", registros_envolvidos: ["genesis"], datacao: [{ periodo: [-539, -332], segundo_quem: "Römer" }] },
    { id: "yhwh-fora-da-biblia", texto: "YHWH em Mesa", registros_envolvidos: ["deus"], datacao: [{ periodo: [-842, -805], segundo_quem: "Louvre" }] },
    { id: "dias-nao-literais", texto: "os dias não precisam ser de 24h", registros_envolvidos: ["genesis"], atemporal: true },
  ];

  const fio = () => compilarFio(passagens, textos, [], afirmacoes, ligacoes, registros);

  test("a espinha sai em ordem de capítulo, não na ordem dos arquivos", () => {
    assert.deepEqual(fio().capitulos.map((c) => c.capitulo), [1, 2]);
  });

  test("conta um grupo por tema e junta os dois temas de leitura num card só", () => {
    const gn1 = fio().capitulos[0];
    const total = (grupo) => gn1.grupos.find((g) => g.grupo === grupo).total;
    assert.equal(total("ciencia"), 1);
    assert.equal(total("paralelo"), 1);
    assert.equal(total("leitura"), 2);
  });

  test("grupo sem conteúdo sai com total zero, para a tela poder omitir o card", () => {
    const gn2 = fio().capitulos[1];
    assert.ok(gn2.grupos.every((g) => g.total === 0));
  });

  test("conta as notas do texto da própria passagem, e só dela", () => {
    const notas = [
      { id: "n1", passagem: "gen-01", tipo: "traducao", versiculos: [3, 3], titulo: "b" },
      { id: "n2", passagem: "gen-01", tipo: "variante", versiculos: [1, 1], titulo: "a" },
      { id: "n3", passagem: "gen-02", tipo: "traducao", versiculos: [1, 1], titulo: "c" },
    ];
    const compilado = compilarFio(passagens, textos, notas, afirmacoes, ligacoes, registros);
    const grupoNota = compilado.capitulos[0].grupos.find((g) => g.grupo === "nota");
    assert.equal(grupoNota.total, 2);
    assert.deepEqual(grupoNota.notas.map((n) => n.id), ["n2", "n1"]);
  });

  test("o resumo do capítulo é a primeira frase de 'afirma'", () => {
    assert.equal(fio().capitulos[0].resumo, "resumo do um");
  });

  test("o nó do livro carrega as datações do próprio texto, em ordem", () => {
    const { livro } = fio();
    assert.equal(livro.registro, "genesis");
    assert.equal(livro.total_capitulos, 50);
    assert.deepEqual(livro.datacoes.map((d) => d.afirmacao), ["autoria-mosaica", "pentateuco-persa"]);
  });

  test("datação ancorada num capítulo não se repete no nó do livro", () => {
    assert.ok(!fio().livro.datacoes.some((d) => d.afirmacao === "idade-do-universo"));
  });

  test("datação que não pende de capítulo nem do livro sai em fora_do_fio, sem se perder", () => {
    const { fora_do_fio } = fio();
    assert.deepEqual(fora_do_fio.map((d) => d.afirmacao), ["yhwh-fora-da-biblia"]);
  });

  test("afirmação atemporal não inventa entrada em lugar nenhum", () => {
    const compilado = fio();
    const todas = [...compilado.livro.datacoes, ...compilado.fora_do_fio];
    assert.ok(!todas.some((d) => d.afirmacao === "dias-nao-literais"));
  });

  test("ignora passagem sem texto de leitura", () => {
    const compilado = compilarFio([{ id: "solta", texto: undefined }], textos, [], afirmacoes, ligacoes, registros);
    assert.equal(compilado.capitulos.length, 0);
  });
});

describe("compilarCapitulos", () => {
  const texto = { id: "genesis-01", livro: "Gênesis", capitulo: 1, traducao: { sigla: "X" }, versiculos: [{ n: 1, texto: "a" }] };
  const passagem = {
    id: "gen-01",
    referencia: "Gênesis 1:1",
    titulo: "Criação",
    afirma: ["x"],
    texto: "genesis-01",
    conexoes: [
      { ligacao: "b", versiculos: [5, 5], tema: "ciencia" },
      { ligacao: "a", versiculos: [1, 2], tema: "paralelo" },
    ],
  };

  test("gera um capítulo por passagem com texto, com notas da passagem e conexões em ordem de versículo", () => {
    const notas = [
      { id: "n2", passagem: "gen-01", versiculos: [3, 3] },
      { id: "n1", passagem: "gen-01", versiculos: [1, 1] },
      { id: "outra", passagem: "gen-02", versiculos: [1, 1] },
    ];
    const { capitulos, indice } = compilarCapitulos([passagem], [texto], notas);
    assert.equal(capitulos.length, 1);
    assert.deepEqual(capitulos[0].notas.map((n) => n.id), ["n1", "n2"]);
    assert.deepEqual(capitulos[0].conexoes.map((c) => c.ligacao), ["a", "b"]);
    assert.deepEqual(indice, [{ id: "genesis-01", livro: "Gênesis", capitulo: 1, passagem: "gen-01", titulo: "Criação" }]);
  });

  test("ignora passagem sem texto de leitura", () => {
    const { capitulos } = compilarCapitulos([{ ...passagem, texto: undefined }], [texto], []);
    assert.equal(capitulos.length, 0);
  });
});
