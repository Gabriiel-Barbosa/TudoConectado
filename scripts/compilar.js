#!/usr/bin/env node
// Lê todo YAML válido em dados/ e gera docs/grafo.json e docs/timeline.json.
// Esses dois arquivos são artefato de build — nunca editados à mão (seção 6).
// Rodar scripts/validar.js antes; este script não revalida.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DADOS = path.join(ROOT, "dados");
const DOCS = path.join(ROOT, "docs");

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

function carregarYaml(pasta) {
  if (!existsSync(pasta)) return [];
  return [...listarYamlRecursivo(pasta)].map((caminho) => yaml.load(readFileSync(caminho, "utf-8")));
}

// Nós: registros, afirmações e passagens — as três coisas que aparecem no
// grafo navegável. Passagens entram como nó (e não só como um índice à parte)
// porque a interface precisa poder "nascer" de um capítulo e se espalhar para
// fora dele (ver seção 7).
function compilarGrafo(registros, afirmacoes, passagens, ligacoes) {
  const nos = [
    ...registros.map((r) => ({
      id: r.id,
      tipo: "registro",
      subtipo: r.tipo,
      nome: r.nome,
      alias: r.alias || [],
      descricao: r.descricao,
    })),
    ...afirmacoes.map((a) => ({
      id: a.id,
      tipo: "afirmacao",
      texto: a.texto,
      datacao: a.datacao,
    })),
    ...passagens.map((p) => ({
      id: p.id,
      tipo: "passagem",
      referencia: p.referencia,
      afirma: p.afirma || [],
      nenhum_paralelo_conhecido: Boolean(p.nenhum_paralelo_conhecido),
    })),
  ];

  const arestas = [];

  for (const ligacao of ligacoes) {
    const pontas = ligacao.entre.map((item) => Object.values(item)[0]);
    for (let i = 0; i < pontas.length - 1; i++) {
      arestas.push({
        id: `${ligacao.id}__${i}`,
        ligacao: ligacao.id,
        origem: pontas[i],
        destino: pontas[i + 1],
        tipo: ligacao.tipo,
        forca: ligacao.evidencia.forca,
        // O schema já exige tipo_de_apoio/quem_sustenta e aceita notas e
        // justificativa_copia; sem exportar aqui, a interface não consegue
        // separar evidência arqueológica de textual, nem mostrar o limite
        // da evidência que os dados já registram em 'notas'.
        tipo_de_apoio: ligacao.evidencia.tipo_de_apoio ?? null,
        quem_sustenta: ligacao.evidencia.quem_sustenta || [],
        fontes: ligacao.fontes,
        o_que_derrubaria: ligacao.o_que_derrubaria,
        notas: ligacao.notas ?? null,
        // Só existe em ligações foi_copiado_de (ver 'if/then' do schema) —
        // fica de fora do JSON em vez de virar null nas outras.
        ...(ligacao.justificativa_copia ? { justificativa_copia: ligacao.justificativa_copia } : {}),
      });
    }
  }

  // Arestas estruturais: uma passagem cita registros/afirmações diretamente.
  // São o ponto de entrada da árvore ("nasce daquele capítulo"), distintas
  // das arestas de ligação (que carregam evidência e força).
  for (const passagem of passagens) {
    for (const ref of passagem.registros_citados || []) {
      arestas.push({ id: `${passagem.id}__cita__${ref}`, origem: passagem.id, destino: ref, tipo: "cita" });
    }
    for (const ref of passagem.afirmacoes_citadas || []) {
      arestas.push({ id: `${passagem.id}__cita__${ref}`, origem: passagem.id, destino: ref, tipo: "cita" });
    }
  }

  // Arestas estruturais: uma afirmação envolve os registros sobre os quais
  // ela fala. Sem isso, uma afirmação só entra no grafo através de uma
  // Ligação — se nenhuma ligação a conectar de volta ao registro/livro que
  // ela descreve, ela fica num componente desconectado, flutuando sozinha.
  for (const afirmacao of afirmacoes) {
    for (const ref of afirmacao.registros_envolvidos || []) {
      arestas.push({ id: `${afirmacao.id}__envolve__${ref}`, origem: afirmacao.id, destino: ref, tipo: "envolve" });
    }
  }

  return { nos, arestas };
}

function compilarTimeline(afirmacoes) {
  const linha = [];
  for (const afirmacao of afirmacoes) {
    for (const datacao of afirmacao.datacao || []) {
      linha.push({
        afirmacao: afirmacao.id,
        texto: afirmacao.texto,
        periodo: datacao.periodo,
        segundo_quem: datacao.segundo_quem,
      });
    }
  }
  linha.sort((a, b) => a.periodo[0] - b.periodo[0]);
  return linha;
}

function main() {
  const registros = ["pessoa", "lugar", "acontecimento", "texto", "objeto"].flatMap((tipo) =>
    carregarYaml(path.join(DADOS, "registros", tipo))
  );
  const afirmacoes = carregarYaml(path.join(DADOS, "afirmacoes"));
  const ligacoes = carregarYaml(path.join(DADOS, "ligacoes"));
  const passagens = carregarYaml(path.join(DADOS, "passagens"));

  mkdirSync(DOCS, { recursive: true });

  const grafo = compilarGrafo(registros, afirmacoes, passagens, ligacoes);
  writeFileSync(path.join(DOCS, "grafo.json"), JSON.stringify(grafo, null, 2), "utf-8");

  const timeline = compilarTimeline(afirmacoes);
  writeFileSync(path.join(DOCS, "timeline.json"), JSON.stringify(timeline, null, 2), "utf-8");

  console.log(
    `docs/grafo.json: ${grafo.nos.length} nó(s), ${grafo.arestas.length} aresta(s)\n` +
      `docs/timeline.json: ${timeline.length} entrada(s)`
  );
}

export { compilarGrafo, compilarTimeline };

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main();
}
