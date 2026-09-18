#!/usr/bin/env node
// Valida todo arquivo em dados/ contra o schema do seu tipo e as regras
// cruzadas da seção 5 de arquitetura-tudo-conectado.md. Sai com código != 0
// se qualquer arquivo falhar.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import yaml from "js-yaml";
import Ajv from "ajv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DADOS = path.join(ROOT, "dados");
const SCHEMA_DIR = path.join(ROOT, "schema");

const CATEGORIAS = {
  registro: {
    schema: "registro.schema.json",
    pastas: ["pessoa", "lugar", "acontecimento", "texto", "objeto"].map((tipo) =>
      path.join(DADOS, "registros", tipo)
    ),
  },
  afirmacao: { schema: "afirmacao.schema.json", pastas: [path.join(DADOS, "afirmacoes")] },
  ligacao: { schema: "ligacao.schema.json", pastas: [path.join(DADOS, "ligacoes")] },
  passagem: { schema: "passagem.schema.json", pastas: [path.join(DADOS, "passagens")] },
};

const ajv = new Ajv({ allErrors: true, strict: false });

function toRel(caminho) {
  return path.relative(ROOT, caminho).split(path.sep).join("/");
}

function carregarValidador(nomeSchema) {
  const schema = JSON.parse(readFileSync(path.join(SCHEMA_DIR, nomeSchema), "utf-8"));
  return ajv.compile(schema);
}

function* listarYamlRecursivo(pasta) {
  const entradas = readdirSync(pasta, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entrada of entradas) {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) {
      yield* listarYamlRecursivo(caminho);
    } else if (entrada.name.endsWith(".yaml")) {
      yield caminho;
    }
  }
}

function* encontrarArquivos(pastas) {
  for (const pasta of pastas) {
    if (!existsSync(pasta)) continue;
    yield* listarYamlRecursivo(pasta);
  }
}

function validarRegrasDeLigacao(ligacoes) {
  const erros = [];
  for (const [rel, ligacao] of ligacoes) {
    const fontes = ligacao.fontes || [];
    if (!fontes.some((f) => f.nivel === 1 || f.nivel === 2)) {
      erros.push(`${rel}: nenhuma fonte de nível 1 ou 2 (seção 6 da metodologia)`);
    }
    if (fontes.length === 1 && fontes[0].nivel === 4) {
      erros.push(`${rel}: fonte de nível 4 não pode ser o único apoio da ligação (seção 6)`);
    }
  }
  return erros;
}

// Direção da ligação: entre[0] é o sujeito (quem confirma, contradiz, foi
// copiado) e entre[1] é o alvo — a mesma ordem em que o id se lê
// ("6qpaleogen-confirma-genesis"). O compilar.js desenha a seta de entre[0]
// para entre[1], então uma ordem trocada inverte o sentido da seta no mapa.
// Só acusa quando o id casa MELHOR com a ordem trocada do que com a ordem
// escrita; ids que não seguem o padrão sujeito-tipo-alvo passam em silêncio.
function validarDirecaoDeLigacao(ligacoes) {
  const erros = [];
  const pedacos = (texto) => new Set(texto.split(/[-_]/).filter(Boolean));
  const emComum = (a, b) => [...a].filter((p) => b.has(p)).length;
  for (const [rel, ligacao] of ligacoes) {
    const pontas = (ligacao.entre || []).map((item) => Object.values(item)[0]);
    if (pontas.length !== 2 || !ligacao.id || !ligacao.tipo) continue;
    const partes = ligacao.id.split(new RegExp(`[-_]${ligacao.tipo}[-_]`));
    if (partes.length !== 2) continue;
    const [sujeito, alvo] = partes.map(pedacos);
    const [primeira, segunda] = pontas.map(pedacos);
    const naOrdem = emComum(sujeito, primeira) + emComum(alvo, segunda);
    const trocada = emComum(sujeito, segunda) + emComum(alvo, primeira);
    if (trocada > naOrdem) {
      const verbo = ligacao.tipo.replace(/_/g, " ");
      erros.push(
        `${rel}: 'entre' parece estar na ordem inversa — pelo id, '${pontas[1]}' é o sujeito, mas está em entre[1]. entre[0] deve ser quem ${verbo}; entre[1], o alvo`
      );
    }
  }
  return erros;
}

// IDs precisam ser únicos globalmente, não só dentro da própria categoria —
// registro, afirmação, ligação e passagem compartilham o mesmo espaço de IDs
// no grafo compilado (scripts/compilar.js), então uma colisão entre categorias
// fundiria dois nós diferentes silenciosamente.
function validarIdsUnicos(idsPorCategoria) {
  const erros = [];
  const vistos = new Map(); // id -> [categoria, rel]
  for (const [categoria, mapa] of Object.entries(idsPorCategoria)) {
    for (const [id, rel] of mapa) {
      if (vistos.has(id)) {
        const [categoriaAnterior, relAnterior] = vistos.get(id);
        erros.push(
          `${rel}: id '${id}' duplicado — já usado em ${relAnterior} (categoria '${categoriaAnterior}'); IDs precisam ser únicos entre todas as categorias`
        );
      } else {
        vistos.set(id, [categoria, rel]);
      }
    }
  }
  return erros;
}

function validarIntegridadeReferencial(dadosPorCategoria, idsPorCategoria) {
  const erros = [];
  const idsRegistros = idsPorCategoria.registro;
  const idsAfirmacoes = idsPorCategoria.afirmacao;
  const idsLigacoes = idsPorCategoria.ligacao;

  for (const [rel, afirmacao] of dadosPorCategoria.afirmacao) {
    for (const ref of afirmacao.registros_envolvidos || []) {
      if (!idsRegistros.has(ref)) erros.push(`${rel}: registro '${ref}' referenciado não existe`);
    }
  }

  for (const [rel, ligacao] of dadosPorCategoria.ligacao) {
    for (const item of ligacao.entre || []) {
      if (item.afirmacao && !idsAfirmacoes.has(item.afirmacao)) {
        erros.push(`${rel}: afirmação '${item.afirmacao}' referenciada não existe`);
      }
      if (item.registro && !idsRegistros.has(item.registro)) {
        erros.push(`${rel}: registro '${item.registro}' referenciado não existe`);
      }
    }
  }

  for (const [rel, passagem] of dadosPorCategoria.passagem) {
    for (const ref of passagem.registros_citados || []) {
      if (!idsRegistros.has(ref)) erros.push(`${rel}: registro '${ref}' referenciado não existe`);
    }
    for (const ref of passagem.afirmacoes_citadas || []) {
      if (!idsAfirmacoes.has(ref)) erros.push(`${rel}: afirmação '${ref}' referenciada não existe`);
    }
    for (const paralelo of passagem.paralelos_externos || []) {
      if (paralelo.ligacao && !idsLigacoes.has(paralelo.ligacao)) {
        erros.push(`${rel}: ligação '${paralelo.ligacao}' referenciada não existe`);
      }
    }
  }

  return erros;
}

function main() {
  const erros = [];
  const dadosPorCategoria = {};
  const idsPorCategoria = {
    registro: new Map(),
    afirmacao: new Map(),
    ligacao: new Map(),
    passagem: new Map(),
  };

  for (const [categoria, cfg] of Object.entries(CATEGORIAS)) {
    const validar = carregarValidador(cfg.schema);
    dadosPorCategoria[categoria] = [];

    for (const caminho of encontrarArquivos(cfg.pastas)) {
      const rel = toRel(caminho);
      const conteudo = yaml.load(readFileSync(caminho, "utf-8"));

      if (typeof conteudo !== "object" || conteudo === null || Array.isArray(conteudo)) {
        erros.push(`${rel}: arquivo YAML vazio ou não é um objeto`);
        continue;
      }

      if (!validar(conteudo)) {
        for (const erro of validar.errors) {
          const caminhoCampo = erro.instancePath ? erro.instancePath.slice(1) : "(raiz)";
          erros.push(`${rel}: [${caminhoCampo}] ${erro.message}`);
        }
      }

      const nomeArquivo = path.basename(caminho, ".yaml");
      if (conteudo.id && nomeArquivo !== conteudo.id) {
        erros.push(`${rel}: nome do arquivo ('${nomeArquivo}') difere do id ('${conteudo.id}')`);
      }

      dadosPorCategoria[categoria].push([rel, conteudo]);

      if (conteudo.id) {
        const mapa = idsPorCategoria[categoria];
        if (mapa.has(conteudo.id)) {
          erros.push(`${rel}: id '${conteudo.id}' duplicado — já usado em ${mapa.get(conteudo.id)}`);
        } else {
          mapa.set(conteudo.id, rel);
        }
      }
    }
  }

  erros.push(...validarIdsUnicos(idsPorCategoria));
  erros.push(...validarRegrasDeLigacao(dadosPorCategoria.ligacao));
  erros.push(...validarDirecaoDeLigacao(dadosPorCategoria.ligacao));
  erros.push(...validarIntegridadeReferencial(dadosPorCategoria, idsPorCategoria));

  if (erros.length > 0) {
    console.log(`${erros.length} problema(s) encontrado(s):\n`);
    for (const erro of erros) console.log(`  - ${erro}`);
    process.exitCode = 1;
    return;
  }

  const total = Object.values(dadosPorCategoria).reduce((soma, v) => soma + v.length, 0);
  console.log(`OK — ${total} arquivo(s) validado(s) em dados/.`);
}

export { validarRegrasDeLigacao, validarDirecaoDeLigacao, validarIdsUnicos, validarIntegridadeReferencial };

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main();
}
