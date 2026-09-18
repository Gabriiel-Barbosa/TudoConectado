#!/usr/bin/env node
// Mantém o cache-bust (?v=N) de docs/index.html coerente.
//
// Uso:
//   node .claude/skills/publicar/scripts/versao-assets.js --verificar
//       Sai com 1 se estilo.css e app.js tiverem ?v= diferentes entre si.
//   node .claude/skills/publicar/scripts/versao-assets.js --se-mudou
//       Se algo em docs/assets/ difere do último commit E a versão ainda não
//       foi incrementada desde ele, incrementa as duas referências juntas.
//       Rodar duas vezes não incrementa duas vezes.
//
// Sem isso, basta esquecer uma das duas referências para o navegador servir
// CSS novo com JS velho (a classe de bug corrigida em 9bd97e0).

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const INDEX = path.join(ROOT, "docs", "index.html");
const REF = /(assets\/(?:estilo\.css|app\.js)\?v=)(\d+)/g;

function versoes(html) {
  return [...html.matchAll(REF)].map((m) => Number(m[2]));
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
}

const html = readFileSync(INDEX, "utf-8");
const atuais = versoes(html);

if (atuais.length < 2) {
  console.error("docs/index.html: esperava ?v= em estilo.css e em app.js — referência não encontrada.");
  process.exit(2);
}

const coerente = new Set(atuais).size === 1;

if (process.argv.includes("--verificar")) {
  if (!coerente) {
    console.log(`INCOERENTE: docs/index.html tem versões diferentes: ${atuais.join(", ")}`);
    process.exit(1);
  }
  console.log(`ok: estilo.css e app.js em ?v=${atuais[0]}`);
  process.exit(0);
}

if (process.argv.includes("--se-mudou")) {
  let assetsMudaram;
  try {
    execFileSync("git", ["diff", "--quiet", "HEAD", "--", "docs/assets"], { cwd: ROOT, stdio: "ignore" });
    assetsMudaram = false;
  } catch {
    assetsMudaram = true;
  }

  let versaoNoHead = null;
  try {
    versaoNoHead = Math.max(...versoes(git(["show", "HEAD:docs/index.html"])));
  } catch {
    // Sem commit anterior de index.html: qualquer versão atual vale como nova.
  }

  const maior = Math.max(...atuais);
  if (!assetsMudaram) {
    console.log(`docs/assets/ sem mudanças desde o último commit — ?v=${maior} mantido.`);
  } else if (versaoNoHead !== null && maior > versaoNoHead && coerente) {
    console.log(`docs/assets/ mudou, mas ?v= já foi incrementado (${versaoNoHead} -> ${maior}) — nada a fazer.`);
  } else {
    const nova = Math.max(maior, versaoNoHead ?? 0) + 1;
    writeFileSync(INDEX, html.replace(REF, (_, prefixo) => `${prefixo}${nova}`), "utf-8");
    console.log(`docs/assets/ mudou — ?v= incrementado para ${nova} em estilo.css e app.js.`);
  }
  process.exit(0);
}

console.error("Uso: versao-assets.js --verificar | --se-mudou");
process.exit(2);
