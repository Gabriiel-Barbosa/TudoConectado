#!/usr/bin/env node
// Gera um checklist Markdown com uma linha por fonte citada em dados/ligacoes/,
// para conferência manual (seção 5 da arquitetura: o script não verifica se a
// citação realmente diz o que se afirma — isso continua exigindo revisão humana).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LIGACOES = path.join(ROOT, "dados", "ligacoes");
const SAIDA = path.join(ROOT, "docs", "checklist_citacoes.md");

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

function main() {
  const linhas = ["# Checklist de citações a conferir", ""];
  let total = 0;

  if (existsSync(LIGACOES)) {
    for (const caminho of listarYamlRecursivo(LIGACOES)) {
      const ligacao = yaml.load(readFileSync(caminho, "utf-8"));
      if (!ligacao) continue;
      for (const fonte of ligacao.fontes || []) {
        total += 1;
        linhas.push(`- [ ] \`${ligacao.id}\` (nível ${fonte.nivel}): ${fonte.descricao}`);
      }
    }
  }

  if (total === 0) {
    linhas.push("_Nenhuma ligação encontrada em dados/ligacoes/._");
  }

  mkdirSync(path.dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, linhas.join("\n") + "\n", "utf-8");
  console.log(`docs/checklist_citacoes.md: ${total} citação(ões) listada(s)`);
}

main();
