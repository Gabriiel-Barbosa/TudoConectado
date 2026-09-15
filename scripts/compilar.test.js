import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { compilarGrafo, compilarTimeline } from "./compilar.js";

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
