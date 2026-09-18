#!/usr/bin/env node
// Grava os vereditos da Contraprova em conferencias/<id-da-ligacao>.yaml.
//
// Uso:
//   node .claude/skills/conferir/scripts/registrar.js <arquivo.json>
//
// O JSON é uma lista, um item por ligação:
//   [{ "ligacao": "<id>",
//      "fontes": [{ "hash": "...", "alegacao": "...", "veredito": "confirmada",
//                   "parou_em": null, "conferido_em": "...", "observacao": "" }] }]
//
// Recusa (e não grava nada) se algum hash não corresponder a uma fonte atual
// da ligação — isso significa que a fonte mudou depois de ser entregue à
// Contraprova, e o veredito se refere a outra coisa.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { CONFERENCIAS, VEREDITOS, carregarConferencia, carregarDados,
  conferiveis, hashFonte, hoje, toRel } from "./lib-dados.js";

const PAROU_EM = [null, "existencia_da_obra", "localizacao", "conteudo"];

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("Uso: registrar.js <arquivo.json>");
  process.exit(2);
}

let entrada;
try {
  entrada = JSON.parse(readFileSync(arquivo, "utf-8"));
} catch (erro) {
  console.error(`Não foi possível ler ${arquivo} como JSON: ${erro.message}`);
  process.exit(2);
}
if (!Array.isArray(entrada)) {
  console.error("O JSON precisa ser uma lista de { ligacao, fontes }.");
  process.exit(2);
}

let dados;
try {
  dados = carregarDados();
} catch (erro) {
  console.error(erro.message);
  process.exit(2);
}
const ligacoes = new Map(conferiveis(dados).map((l) => [l.dado?.id, l.dado]));

const erros = [];
const gravacoes = [];

for (const item of entrada) {
  const ligacao = ligacoes.get(item.ligacao);
  if (!ligacao) {
    erros.push(`ligação ou nota '${item.ligacao}' não existe em dados/ligacoes/ nem em dados/notas/`);
    continue;
  }
  const atuais = new Map((ligacao.fontes || []).map((f) => [hashFonte(ligacao, f), f]));

  for (const v of item.fontes || []) {
    const onde = `${item.ligacao} / ${v.hash}`;
    if (!atuais.has(v.hash)) erros.push(`${onde}: hash não corresponde a nenhuma fonte atual (a fonte mudou?)`);
    if (!VEREDITOS.includes(v.veredito)) erros.push(`${onde}: veredito '${v.veredito}' inválido (use ${VEREDITOS.join(" | ")})`);
    if (!PAROU_EM.includes(v.parou_em ?? null)) erros.push(`${onde}: parou_em '${v.parou_em}' inválido`);
    if (v.veredito === "confirmada" && v.parou_em) erros.push(`${onde}: veredito confirmada não pode ter parou_em`);
    if (v.veredito !== "confirmada" && !v.parou_em) erros.push(`${onde}: veredito ${v.veredito} exige parou_em`);
    if (!v.alegacao) erros.push(`${onde}: falta 'alegacao' (o que foi conferido)`);
    if (v.veredito === "confirmada" && !v.conferido_em) erros.push(`${onde}: confirmada sem 'conferido_em'`);
  }
  gravacoes.push({ ligacao, atuais, vereditos: item.fontes || [] });
}

if (erros.length > 0) {
  console.error(`Nada foi gravado — ${erros.length} problema(s):`);
  for (const e of erros) console.error(`  - ${e}`);
  process.exit(1);
}

mkdirSync(CONFERENCIAS, { recursive: true });

for (const { ligacao, atuais, vereditos } of gravacoes) {
  const anterior = carregarConferencia(ligacao.id);
  const porHash = new Map((anterior?.fontes || []).map((f) => [f.hash, f]));

  for (const v of vereditos) {
    const antes = porHash.get(v.hash);
    // A revisão humana só sobrevive se o veredito não mudou: um veredito novo
    // precisa ser revisado de novo.
    const revisaoHumana = antes && antes.veredito === v.veredito ? antes.revisao_humana : "pendente";
    porHash.set(v.hash, {
      hash: v.hash,
      nivel: atuais.get(v.hash).nivel,
      descricao: atuais.get(v.hash).descricao,
      alegacao: v.alegacao,
      veredito: v.veredito,
      parou_em: v.parou_em ?? null,
      conferido_em: v.conferido_em || null,
      observacao: v.observacao || "",
      data: hoje(),
      conferido_por: "contraprova",
      revisao_humana: revisaoHumana,
    });
  }

  // Descarta vereditos de fontes que não existem mais na ligação.
  const fontes = [...atuais.keys()].filter((h) => porHash.has(h)).map((h) => porHash.get(h));
  const destino = path.join(CONFERENCIAS, `${ligacao.id}.yaml`);
  const cabecalho =
    "# Gerado por .claude/skills/conferir/scripts/registrar.js — vereditos da\n" +
    "# Contraprova para as fontes desta ligação. Edite à mão só 'revisao_humana'\n" +
    "# (pendente -> feita) depois de conferir você mesmo.\n";
  writeFileSync(destino, cabecalho + yaml.dump({ ligacao: ligacao.id, fontes }, { lineWidth: 100 }), "utf-8");
  console.log(`${toRel(destino)}: ${vereditos.length} veredito(s) gravado(s)`);
}
