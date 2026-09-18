import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validarRegrasDeLigacao,
  validarDirecaoDeLigacao,
  validarIdsUnicos,
  validarIntegridadeReferencial,
  validarCapitulos,
} from "./validar.js";

describe("validarCapitulos", () => {
  const texto = (versiculos) => ["t.yaml", { id: "genesis-01", versiculos: versiculos.map((n) => ({ n, texto: "x" })) }];
  const passagem = (extra = {}) => ["p.yaml", { id: "gen-01", texto: "genesis-01", ...extra }];
  const base = (extra = {}) => ({
    texto_biblico: [texto([1, 2, 3])],
    passagem: [passagem(extra.passagem)],
    ligacao: [["l.yaml", { id: "lig" }]],
    nota_textual: extra.notas || [],
  });

  test("passa com texto contínuo, âncoras dentro do capítulo e referências existentes", () => {
    const dados = base({
      passagem: { conexoes: [{ ligacao: "lig", versiculos: [1, 3], tema: "paralelo" }] },
      notas: [["n.yaml", { id: "n", passagem: "gen-01", versiculos: [2, 2] }]],
    });
    assert.deepEqual(validarCapitulos(dados), []);
  });

  test("recusa versículo pulado na numeração", () => {
    const dados = { ...base(), texto_biblico: [texto([1, 3])] };
    assert.ok(validarCapitulos(dados).some((e) => /sem buraco/.test(e)));
  });

  test("recusa âncora além do fim do capítulo e âncora invertida", () => {
    const dados = base({
      passagem: { conexoes: [{ ligacao: "lig", versiculos: [2, 9], tema: "ciencia" }] },
      notas: [["n.yaml", { id: "n", passagem: "gen-01", versiculos: [3, 1] }]],
    });
    const erros = validarCapitulos(dados);
    assert.ok(erros.some((e) => /capítulo tem 3/.test(e)));
    assert.ok(erros.some((e) => /maior que o último/.test(e)));
  });

  test("recusa texto, ligação e passagem inexistentes", () => {
    const dados = base({
      passagem: { texto: "fantasma", conexoes: [{ ligacao: "nao-existe", versiculos: [1, 1], tema: "paralelo" }] },
      notas: [["n.yaml", { id: "n", passagem: "outra", versiculos: [1, 1] }]],
    });
    const erros = validarCapitulos(dados);
    assert.ok(erros.some((e) => /texto 'fantasma' não existe/.test(e)));
    assert.ok(erros.some((e) => /ligação 'nao-existe'/.test(e)));
    assert.ok(erros.some((e) => /passagem 'outra' não existe/.test(e)));
  });
});

describe("validarRegrasDeLigacao", () => {
  test("passa quando há fonte de nível 1", () => {
    const ligacoes = [["a.yaml", { fontes: [{ nivel: 1, descricao: "x" }] }]];
    assert.deepEqual(validarRegrasDeLigacao(ligacoes), []);
  });

  test("passa quando há fonte de nível 2 junto com uma de nível 4", () => {
    const ligacoes = [
      ["a.yaml", { fontes: [{ nivel: 2, descricao: "x" }, { nivel: 4, descricao: "y" }] }],
    ];
    assert.deepEqual(validarRegrasDeLigacao(ligacoes), []);
  });

  test("recusa quando só há fontes de nível 3 ou 4 (nenhuma nível 1/2)", () => {
    const ligacoes = [["a.yaml", { fontes: [{ nivel: 3, descricao: "x" }] }]];
    const erros = validarRegrasDeLigacao(ligacoes);
    assert.equal(erros.length, 1);
    assert.match(erros[0], /nenhuma fonte de nível 1 ou 2/);
  });

  test("recusa fonte de nível 4 como único apoio", () => {
    const ligacoes = [["a.yaml", { fontes: [{ nivel: 4, descricao: "x" }] }]];
    const erros = validarRegrasDeLigacao(ligacoes);
    assert.ok(erros.some((e) => /nível 4 não pode ser o único apoio/.test(e)));
  });

  test("ligação sem fontes acumula os dois erros", () => {
    const ligacoes = [["a.yaml", { fontes: [] }]];
    const erros = validarRegrasDeLigacao(ligacoes);
    assert.equal(erros.length, 1); // só a regra de nível 1/2 se aplica com lista vazia
  });
});

describe("validarDirecaoDeLigacao", () => {
  const ligacao = (id, tipo, a, b) => ["l.yaml", { id, tipo, entre: [{ registro: a }, { registro: b }] }];

  test("passa quando entre segue a ordem sujeito → alvo do id", () => {
    const l = ligacao("6qpaleogen-confirma-genesis", "confirma", "manuscrito-6qpaleogen", "genesis");
    assert.deepEqual(validarDirecaoDeLigacao([l]), []);
  });

  test("recusa quando entre está na ordem inversa do id", () => {
    const l = ligacao("6qpaleogen-confirma-genesis", "confirma", "genesis", "manuscrito-6qpaleogen");
    const erros = validarDirecaoDeLigacao([l]);
    assert.ok(erros.some((e) => /ordem inversa/.test(e)));
  });

  test("entende tipos com _ e ids separados por _", () => {
    const certa = ligacao("gilgamesh_foi_copiado_de_atrahasis", "foi_copiado_de", "epopeia-gilgamesh", "atrahasis");
    const trocada = ligacao("gilgamesh_foi_copiado_de_atrahasis", "foi_copiado_de", "atrahasis", "epopeia-gilgamesh");
    assert.deepEqual(validarDirecaoDeLigacao([certa]), []);
    assert.equal(validarDirecaoDeLigacao([trocada]).length, 1);
  });

  test("não acusa quando o id não permite decidir", () => {
    const l = ligacao("ligacao-qualquer", "confirma", "x", "y");
    assert.deepEqual(validarDirecaoDeLigacao([l]), []);
  });
});

describe("validarIdsUnicos", () => {
  test("passa quando todos os IDs são únicos entre categorias", () => {
    const ids = {
      registro: new Map([["moises", "a.yaml"]]),
      afirmacao: new Map([["cerco-teste", "b.yaml"]]),
      ligacao: new Map(),
      passagem: new Map(),
    };
    assert.deepEqual(validarIdsUnicos(ids), []);
  });

  test("recusa quando o mesmo ID aparece em duas categorias diferentes", () => {
    const ids = {
      registro: new Map([["genesis", "dados/registros/texto/genesis.yaml"]]),
      afirmacao: new Map([["genesis", "dados/afirmacoes/genesis.yaml"]]),
      ligacao: new Map(),
      passagem: new Map(),
    };
    const erros = validarIdsUnicos(ids);
    assert.equal(erros.length, 1);
    assert.match(erros[0], /id 'genesis' duplicado/);
  });
});

describe("validarIntegridadeReferencial", () => {
  const idsBase = {
    registro: new Map([["moises", "r.yaml"]]),
    afirmacao: new Map([["afirmacao-x", "a.yaml"]]),
    ligacao: new Map([["ligacao-x", "l.yaml"]]),
    passagem: new Map(),
  };

  test("passa quando toda referência existe", () => {
    const dados = {
      afirmacao: [["a.yaml", { registros_envolvidos: ["moises"] }]],
      ligacao: [["l.yaml", { entre: [{ registro: "moises" }, { afirmacao: "afirmacao-x" }] }]],
      passagem: [
        [
          "p.yaml",
          {
            registros_citados: ["moises"],
            afirmacoes_citadas: ["afirmacao-x"],
            paralelos_externos: [{ ligacao: "ligacao-x" }],
          },
        ],
      ],
    };
    assert.deepEqual(validarIntegridadeReferencial(dados, idsBase), []);
  });

  test("recusa registro inexistente referenciado por uma afirmação", () => {
    const dados = {
      afirmacao: [["a.yaml", { registros_envolvidos: ["nao-existe"] }]],
      ligacao: [],
      passagem: [],
    };
    const erros = validarIntegridadeReferencial(dados, idsBase);
    assert.ok(erros.some((e) => /registro 'nao-existe' referenciado não existe/.test(e)));
  });

  test("recusa afirmação/registro inexistentes numa ligação", () => {
    const dados = {
      afirmacao: [],
      ligacao: [["l.yaml", { entre: [{ afirmacao: "fantasma" }, { registro: "tambem-fantasma" }] }]],
      passagem: [],
    };
    const erros = validarIntegridadeReferencial(dados, idsBase);
    assert.equal(erros.length, 2);
  });

  test("recusa passagem citando afirmação inexistente (afirmacoes_citadas)", () => {
    const dados = {
      afirmacao: [],
      ligacao: [],
      passagem: [["p.yaml", { afirmacoes_citadas: ["fantasma"] }]],
    };
    const erros = validarIntegridadeReferencial(dados, idsBase);
    assert.ok(erros.some((e) => /afirmação 'fantasma' referenciada não existe/.test(e)));
  });

  test("recusa passagem com paralelo_externo apontando pra ligação inexistente", () => {
    const dados = {
      afirmacao: [],
      ligacao: [],
      passagem: [["p.yaml", { paralelos_externos: [{ ligacao: "fantasma" }] }]],
    };
    const erros = validarIntegridadeReferencial(dados, idsBase);
    assert.ok(erros.some((e) => /ligação 'fantasma' referenciada não existe/.test(e)));
  });
});
