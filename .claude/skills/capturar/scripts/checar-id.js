#!/usr/bin/env node
// Confere se um ID novo pode ser criado, antes de escrever o arquivo.
//
// Uso:
//   node .claude/skills/capturar/scripts/checar-id.js <categoria> <id>
//   node .claude/skills/capturar/scripts/checar-id.js <categoria> --sugerir "<nome livre>"
//
// <categoria>: registro | afirmacao | ligacao | passagem
//
// Verifica: o padrão de ID do schema da categoria (lido de schema/, para
// nunca divergir dele), ausência de acento/espaço/maiúscula, e se o ID já
// existe em QUALQUER categoria — os quatro tipos compartilham o mesmo espaço
// de IDs no grafo compilado. Sai com 0 se o ID está livre e válido.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const CATEGORIAS = ["registro", "afirmacao", "ligacao", "passagem"];

const [categoria, ...resto] = process.argv.slice(2);
if (!CATEGORIAS.includes(categoria) || resto.length === 0) {
  console.error("Uso: checar-id.js <registro|afirmacao|ligacao|passagem> <id> | --sugerir \"<nome>\"");
  process.exit(2);
}

const schema = JSON.parse(readFileSync(path.join(ROOT, "schema", `${categoria}.schema.json`), "utf-8"));
const padrao = new RegExp(schema.properties.id.pattern);

function sugerir(nome) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(de|da|do|das|dos)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function* listarYaml(pasta) {
  if (!existsSync(pasta)) return;
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) yield* listarYaml(caminho);
    else if (entrada.name.endsWith(".yaml")) yield caminho;
  }
}

function ondeJaExiste(id) {
  for (const caminho of listarYaml(path.join(ROOT, "dados"))) {
    if (path.basename(caminho, ".yaml") === id) return caminho;
    try {
      if (yaml.load(readFileSync(caminho, "utf-8"))?.id === id) return caminho;
    } catch {
      // YAML inválido em outro arquivo não é problema deste script — validar.js acusa.
    }
  }
  return null;
}

let id = resto[0];
if (id === "--sugerir") {
  id = sugerir(resto.slice(1).join(" "));
  console.log(`sugestão: ${id}`);
}

const problemas = [];
if (/[^\x00-\x7f]/.test(id)) problemas.push("contém acento ou caractere não-ASCII");
if (/\s/.test(id)) problemas.push("contém espaço");
if (/[A-Z]/.test(id)) problemas.push("contém letra maiúscula");
if (!padrao.test(id)) problemas.push(`não casa com o padrão do schema de ${categoria}: ${schema.properties.id.pattern}`);
if (categoria === "passagem" && !/^gen-\d{2}-\d{2}_\d{2}-\d{2}$/.test(id) && !/^gen-\d{2}$/.test(id)) {
  problemas.push("passagem de Gênesis fora do padrão gen-CC-VV_CC-VV (seção 4 da arquitetura)");
}

const existente = ondeJaExiste(id);
if (existente) {
  problemas.push(`já existe: ${path.relative(ROOT, existente).split(path.sep).join("/")} — IDs nunca são reaproveitados`);
}

if (problemas.length > 0) {
  console.log(`'${id}' NÃO pode ser usado:`);
  for (const p of problemas) console.log(`  - ${p}`);
  process.exit(1);
}
console.log(`'${id}' está livre e válido para ${categoria}.`);
