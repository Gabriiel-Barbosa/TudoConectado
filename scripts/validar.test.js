import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validarRegrasDeLigacao, validarIdsUnicos, validarIntegridadeReferencial } from "./validar.js";

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
