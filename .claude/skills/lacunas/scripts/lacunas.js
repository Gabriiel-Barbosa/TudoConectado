#!/usr/bin/env node
// Relatório do que falta no projeto: onde a evidência é fraca, o que ainda
// não foi mapeado e o que está desconectado. Só lê — não altera nada.
//
// Uso:
//   node .claude/skills/lacunas/scripts/lacunas.js          # Markdown
//   node .claude/skills/lacunas/scripts/lacunas.js --json   # dados brutos

import { carregarDados, situacaoDasFontes } from "../../conferir/scripts/lib-dados.js";

const CAPITULOS_GENESIS = 50; // dados/registros/texto/genesis.yaml

// Heurística — não substitui leitura humana. Procura algum marcador de
// localização exata (seção 7 da metodologia / seção 5 da arquitetura):
// página, capítulo:versículo, coluna/linha, fólio, nº de catálogo, sigla de
// manuscrito do Mar Morto (ex.: 6Q1, 4Q252).
const MARCADORES_LOCALIZACAO = [
  /\bpp?\.\s*\d/i,
  /\bp[aá]g(ina)?s?\.?\s*\d/i,
  /\b(cap(í|i)tulo|cap\.)\s*\d/i,
  /\b\d+\s*:\s*\d+/,
  /\b(coluna|col\.)\s*[IVXLC\d]/i,
  /\b(linhas?|l\.)\s*\d/i,
  /\bf[óo]lios?\s*\d/i,
  /\b\d+[ab]\b/,
  /\b(n[º°o]\.?|inv\.|cat\.|n\.º)\s*\d/i,
  /\b\d+Q\d+/,
  /§\s*\d/,
];

function temLocalizacao(descricao) {
  const semAno = descricao.replace(/\(\d{3,4}\)/g, "");
  return MARCADORES_LOCALIZACAO.some((re) => re.test(semAno));
}

function capitulosDaPassagem(id) {
  const intervalo = id.match(/^gen-(\d{2})-\d{2}_(\d{2})-\d{2}$/);
  if (intervalo) {
    const [ini, fim] = [Number(intervalo[1]), Number(intervalo[2])];
    return Array.from({ length: fim - ini + 1 }, (_, i) => ini + i);
  }
  const inteiro = id.match(/^gen-(\d{2})$/);
  return inteiro ? [Number(inteiro[1])] : [];
}

function agruparIntervalos(numeros) {
  const grupos = [];
  for (const n of numeros) {
    const ultimo = grupos.at(-1);
    if (ultimo && n === ultimo[1] + 1) ultimo[1] = n;
    else grupos.push([n, n]);
  }
  return grupos.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`));
}

let dados;
try {
  dados = carregarDados();
} catch (erro) {
  console.error(erro.message);
  process.exit(2);
}

const registros = dados.registros.map((x) => x.dado).filter(Boolean);
const afirmacoes = dados.afirmacoes.map((x) => x.dado).filter(Boolean);
const ligacoes = dados.ligacoes.map((x) => x.dado).filter(Boolean);
const passagens = dados.passagens.map((x) => x.dado).filter(Boolean);

// --- Integridade da evidência -------------------------------------------------

const fontesSemLocalizacao = [];
const fontesPorSituacao = { nao_confirmavel: [], contradiz: [], desatualizada: [], sem_conferencia: [] };
let revisaoHumanaPendente = 0;

for (const ligacao of ligacoes) {
  for (const f of situacaoDasFontes(ligacao)) {
    if (!temLocalizacao(f.descricao || "")) fontesSemLocalizacao.push({ ligacao: ligacao.id, nivel: f.nivel, descricao: f.descricao });
    if (fontesPorSituacao[f.situacao]) fontesPorSituacao[f.situacao].push({ ligacao: ligacao.id, nivel: f.nivel, descricao: f.descricao });
    if (f.situacao === "confirmada" && f.registro?.revisao_humana !== "feita") revisaoHumanaPendente += 1;
  }
}

const ligacoesSemQuemSustenta = ligacoes.filter((l) => (l.evidencia?.quem_sustenta || []).length === 0).map((l) => l.id);
const ligacoesFonteUnica = ligacoes.filter((l) => (l.fontes || []).length === 1).map((l) => l.id);

// --- Conectividade ------------------------------------------------------------

const citados = new Set();
for (const a of afirmacoes) for (const r of a.registros_envolvidos || []) citados.add(r);
for (const l of ligacoes) for (const item of l.entre || []) citados.add(Object.values(item)[0]);
for (const p of passagens) {
  for (const r of p.registros_citados || []) citados.add(r);
  for (const r of p.afirmacoes_citadas || []) citados.add(r);
}
const registrosIsolados = registros.filter((r) => !citados.has(r.id)).map((r) => r.id);

const emLigacao = new Set(ligacoes.flatMap((l) => (l.entre || []).map((item) => item.afirmacao).filter(Boolean)));
const afirmacoesSemEvidencia = afirmacoes.filter((a) => !emLigacao.has(a.id)).map((a) => a.id);

// --- Cobertura ------------------------------------------------------------------

const tocados = new Set(passagens.flatMap((p) => capitulosDaPassagem(p.id)));
const naoTocados = Array.from({ length: CAPITULOS_GENESIS }, (_, i) => i + 1).filter((c) => !tocados.has(c));
const passagensSemParalelo = passagens.filter((p) => p.nenhum_paralelo_conhecido).map((p) => p.id);
const passagensForaDoPadrao = passagens.filter((p) => capitulosDaPassagem(p.id).length === 0).map((p) => p.id);

// --- Datação --------------------------------------------------------------------

const datacoesPontuais = afirmacoes
  .flatMap((a) => (a.datacao || []).map((d) => ({ afirmacao: a.id, periodo: d.periodo })))
  .filter((d) => Array.isArray(d.periodo) && d.periodo[0] === d.periodo[1]);
const afirmacoesUmaDatacao = afirmacoes.filter((a) => (a.datacao || []).length === 1).map((a) => a.id);

const resultado = {
  totais: { registros: registros.length, afirmacoes: afirmacoes.length, ligacoes: ligacoes.length, passagens: passagens.length },
  evidencia: {
    fontes_contradiz: fontesPorSituacao.contradiz,
    fontes_nao_confirmaveis: fontesPorSituacao.nao_confirmavel,
    fontes_desatualizadas: fontesPorSituacao.desatualizada,
    fontes_sem_conferencia: fontesPorSituacao.sem_conferencia,
    confirmadas_sem_revisao_humana: revisaoHumanaPendente,
    fontes_sem_localizacao_exata: fontesSemLocalizacao,
    afirmacoes_sem_evidencia: afirmacoesSemEvidencia,
  },
  cobertura: {
    capitulos_genesis_nao_tocados: naoTocados,
    passagens_fora_do_padrao: passagensForaDoPadrao,
    registros_isolados: registrosIsolados,
  },
  informativo: {
    passagens_sem_paralelo: passagensSemParalelo,
    ligacoes_sem_quem_sustenta: ligacoesSemQuemSustenta,
    ligacoes_com_fonte_unica: ligacoesFonteUnica,
    datacoes_de_ponto_unico: datacoesPontuais,
    afirmacoes_com_uma_so_datacao: afirmacoesUmaDatacao,
  },
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(resultado, null, 2));
  process.exit(0);
}

const linhas = [];
const t = resultado.totais;
linhas.push(`# Lacunas — ${t.registros} registro(s), ${t.afirmacoes} afirmação(ões), ${t.ligacoes} ligação(ões), ${t.passagens} passagem(ns)`, "");

function secao(titulo, itens, formatar = (x) => `\`${x}\``) {
  linhas.push(`### ${titulo} (${itens.length})`);
  if (itens.length === 0) linhas.push("_nenhuma_");
  else for (const item of itens) linhas.push(`- ${formatar(item)}`);
  linhas.push("");
}
const fmtFonte = (f) => `\`${f.ligacao}\` (nível ${f.nivel}): ${f.descricao}`;

linhas.push("## 1. Integridade da evidência", "");
secao("Fontes que a Contraprova diz que CONTRADIZEM a alegação", resultado.evidencia.fontes_contradiz, fmtFonte);
secao("Fontes não confirmáveis", resultado.evidencia.fontes_nao_confirmaveis, fmtFonte);
secao("Fontes com veredito desatualizado (a ligação mudou)", resultado.evidencia.fontes_desatualizadas, fmtFonte);
secao("Fontes nunca conferidas", resultado.evidencia.fontes_sem_conferencia, fmtFonte);
secao("Fontes sem localização exata (heurística)", resultado.evidencia.fontes_sem_localizacao_exata, fmtFonte);
secao("Afirmações sem nenhuma ligação de evidência", resultado.evidencia.afirmacoes_sem_evidencia);
linhas.push(`Vereditos "confirmada" ainda sem revisão humana: **${revisaoHumanaPendente}**`, "");

linhas.push("## 2. Cobertura", "");
linhas.push(
  `### Capítulos de Gênesis sem nenhuma passagem (${naoTocados.length} de ${CAPITULOS_GENESIS})`,
  naoTocados.length ? agruparIntervalos(naoTocados).join(", ") : "_todos têm ao menos uma passagem_",
  "_\"Tocado\" = ao menos uma passagem começa, termina ou atravessa o capítulo; não significa capítulo inteiro coberto._",
  ""
);
secao("Passagens com ID fora do padrão gen-CC-VV_CC-VV", passagensForaDoPadrao);
secao("Registros isolados (nada os cita)", registrosIsolados);

linhas.push("## 3. Informativo", "");
secao("Passagens que declaram nenhum paralelo externo conhecido", passagensSemParalelo);
secao("Ligações sem ninguém em quem_sustenta", ligacoesSemQuemSustenta);
secao("Ligações apoiadas em uma única fonte", ligacoesFonteUnica);
secao("Datações de ponto único (início = fim)", datacoesPontuais, (d) => `\`${d.afirmacao}\`: [${d.periodo.join(", ")}]`);
secao("Afirmações com uma só datação (nenhuma concorrente registrada)", afirmacoesUmaDatacao);

console.log(linhas.join("\n"));
