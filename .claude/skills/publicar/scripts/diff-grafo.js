#!/usr/bin/env node
// Resume o que mudou em docs/grafo.json em relação ao último commit — para
// conferir, antes de commitar, que a compilação produziu exatamente o que as
// mudanças em dados/ deveriam produzir (nem mais, nem menos).
//
// Uso: node .claude/skills/publicar/scripts/diff-grafo.js

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

function lerAntes() {
  try {
    const bruto = execFileSync("git", ["show", "HEAD:docs/grafo.json"], {
      cwd: ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 256 * 1024 * 1024,
    });
    return JSON.parse(bruto);
  } catch {
    return { nos: [], arestas: [] };
  }
}

let depois;
try {
  depois = JSON.parse(readFileSync(path.join(ROOT, "docs", "grafo.json"), "utf-8"));
} catch (erro) {
  console.error(`docs/grafo.json ilegível — rode npm run compilar primeiro (${erro.message})`);
  process.exit(2);
}
const antes = lerAntes();

function comparar(listaAntes, listaDepois) {
  const a = new Map(listaAntes.map((x) => [x.id, JSON.stringify(x)]));
  const d = new Map(listaDepois.map((x) => [x.id, JSON.stringify(x)]));
  return {
    adicionados: [...d.keys()].filter((id) => !a.has(id)),
    removidos: [...a.keys()].filter((id) => !d.has(id)),
    alterados: [...d.keys()].filter((id) => a.has(id) && a.get(id) !== d.get(id)),
  };
}

const nos = comparar(antes.nos || [], depois.nos || []);
const arestas = comparar(antes.arestas || [], depois.arestas || []);

console.log(`nós:     ${(antes.nos || []).length} -> ${(depois.nos || []).length}`);
console.log(`arestas: ${(antes.arestas || []).length} -> ${(depois.arestas || []).length}`);
for (const [rotulo, diff] of [["nó", nos], ["aresta", arestas]]) {
  for (const [tipo, sinal] of [["adicionados", "+"], ["removidos", "-"], ["alterados", "~"]]) {
    for (const id of diff[tipo]) console.log(`  ${sinal} ${rotulo} ${id}`);
  }
}
if ([nos, arestas].every((d) => d.adicionados.length + d.removidos.length + d.alterados.length === 0)) {
  console.log("  (nenhuma mudança no grafo)");
}
