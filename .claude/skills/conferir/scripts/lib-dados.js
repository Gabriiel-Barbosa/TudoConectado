// Leitura de dados/ e de conferencias/ compartilhada pelos scripts das skills
// /conferir, /lacunas e /publicar. Só lê — quem escreve em conferencias/ é
// registrar.js, e ninguém aqui escreve em dados/.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
export const DADOS = path.join(ROOT, "dados");
export const CONFERENCIAS = path.join(ROOT, "conferencias");

export const VEREDITOS = ["confirmada", "nao_confirmavel", "contradiz"];

export function toRel(caminho) {
  return path.relative(ROOT, caminho).split(path.sep).join("/");
}

function* listarYaml(pasta) {
  if (!existsSync(pasta)) return;
  const entradas = readdirSync(pasta, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entrada of entradas) {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) yield* listarYaml(caminho);
    else if (entrada.name.endsWith(".yaml")) yield caminho;
  }
}

// YAML malformado não pode derrubar o script com stack trace: vira um erro
// que diz qual arquivo corrigir.
export function lerYaml(caminho) {
  try {
    return yaml.load(readFileSync(caminho, "utf-8"));
  } catch (erro) {
    throw new Error(`${toRel(caminho)}: YAML inválido — ${erro.reason || erro.message}`);
  }
}

function carregarPasta(pasta) {
  return [...listarYaml(pasta)].map((caminho) => ({ rel: toRel(caminho), dado: lerYaml(caminho) }));
}

export function carregarDados() {
  return {
    registros: carregarPasta(path.join(DADOS, "registros")),
    afirmacoes: carregarPasta(path.join(DADOS, "afirmacoes")),
    ligacoes: carregarPasta(path.join(DADOS, "ligacoes")),
    passagens: carregarPasta(path.join(DADOS, "passagens")),
    notas: carregarPasta(path.join(DADOS, "notas")),
  };
}

// Tudo o que tem fontes a conferir: ligações e notas textuais (tradução
// discutida, variante). As duas categorias compartilham o espaço de ids.
export function conferiveis(dados) {
  return [...dados.ligacoes, ...dados.notas];
}

// O hash identifica "esta fonte, sustentando esta ligação". Se a descrição
// da fonte, o nível, o tipo da ligação ou as pontas mudarem, o hash muda e o
// veredito antigo deixa de valer — ele conferiu outra coisa. Numa nota
// textual, o papel das pontas é da passagem e dos versículos.
export function hashFonte(ligacao, fonte) {
  const base = JSON.stringify({
    tipo: ligacao.tipo,
    entre: ligacao.entre ?? { passagem: ligacao.passagem, versiculos: ligacao.versiculos },
    nivel: fonte.nivel,
    descricao: fonte.descricao,
  });
  return createHash("sha256").update(base).digest("hex").slice(0, 12);
}

export function carregarConferencia(idLigacao) {
  const caminho = path.join(CONFERENCIAS, `${idLigacao}.yaml`);
  if (!existsSync(caminho)) return null;
  return lerYaml(caminho);
}

// Situação de cada fonte de uma ligação, cruzando com conferencias/.
// sem_conferencia: nunca conferida; desatualizada: a mesma descrição já foi
// conferida, mas o nível, o tipo ou as pontas da ligação mudaram depois do
// veredito; os demais são o próprio veredito registrado.
export function situacaoDasFontes(ligacao) {
  const conferencia = carregarConferencia(ligacao.id);
  const porHash = new Map((conferencia?.fontes || []).map((f) => [f.hash, f]));
  const descricoesConferidas = new Set((conferencia?.fontes || []).map((f) => f.descricao));

  return (ligacao.fontes || []).map((fonte, indice) => {
    const hash = hashFonte(ligacao, fonte);
    const registro = porHash.get(hash);
    let situacao;
    if (registro) situacao = registro.veredito;
    else situacao = descricoesConferidas.has(fonte.descricao) ? "desatualizada" : "sem_conferencia";
    return { indice, hash, nivel: fonte.nivel, descricao: fonte.descricao, situacao, registro: registro || null };
  });
}

// Data local, não UTC — à noite no Brasil o UTC já está no dia seguinte.
export function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
