import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { compilarGrafo, compilarTimeline, compilarCapitulos } from "./compilar.js";

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

describe("compilarTimeline", () => {
  test("gera uma entrada por datação e ordena por início do período", () => {
    const afirmacoes = [
      { id: "a", texto: "depois", datacao: [{ periodo: [-500, -450], segundo_quem: "X" }] },
      { id: "b", texto: "antes", datacao: [{ periodo: [-900, -800], segundo_quem: "Y" }] },
    ];
    const linha = compilarTimeline(afirmacoes);
    assert.equal(linha.length, 2);
    assert.equal(linha[0].afirmacao, "b");
    assert.equal(linha[1].afirmacao, "a");
  });

  test("afirmação com múltiplas datações concorrentes gera uma entrada por datação", () => {
    const afirmacoes = [
      {
        id: "a",
        texto: "t",
        datacao: [
          { periodo: [-700, -690], segundo_quem: "X" },
          { periodo: [-705, -695], segundo_quem: "Y" },
        ],
      },
    ];
    assert.equal(compilarTimeline(afirmacoes).length, 2);
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
