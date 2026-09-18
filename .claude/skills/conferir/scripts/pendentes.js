#!/usr/bin/env node
// Lista as fontes que precisam de conferência, em JSON, prontas para serem
// entregues ao agente Contraprova.
//
// Uso:
//   node .claude/skills/conferir/scripts/pendentes.js                 # todas as ligações
//   node .claude/skills/conferir/scripts/pendentes.js <id> [<id>...]  # só essas
//   ... --incluir-confirmadas   # também as já confirmadas (para refazer)
//   ... --resumo                # só a contagem por situação, em texto
//
// Nunca inclui 'notas' nem 'o_que_derrubaria': são o raciocínio de quem
// propôs a ligação, e a Contraprova não pode vê-lo.

import { carregarDados, conferiveis, situacaoDasFontes } from "./lib-dados.js";

const args = process.argv.slice(2);
const incluirConfirmadas = args.includes("--incluir-confirmadas");
const resumo = args.includes("--resumo");
const ids = args.filter((a) => !a.startsWith("--"));

let dados;
try {
  dados = carregarDados();
} catch (erro) {
  console.error(erro.message);
  process.exit(2);
}

const nomes = new Map();
for (const { dado } of dados.registros) if (dado?.id) nomes.set(dado.id, { tipo: "registro", nome: dado.nome, subtipo: dado.tipo });
for (const { dado } of dados.afirmacoes) if (dado?.id) nomes.set(dado.id, { tipo: "afirmacao", texto: dado.texto });

const idsExistentes = new Set(conferiveis(dados).map((l) => l.dado?.id));
const inexistentes = ids.filter((id) => !idsExistentes.has(id));
if (inexistentes.length > 0) {
  console.error(`Ligação(ões) ou nota(s) não encontrada(s) em dados/ligacoes/ e dados/notas/: ${inexistentes.join(", ")}`);
  process.exit(2);
}

const saida = [];
const contagem = {};

for (const { rel, dado: ligacao } of conferiveis(dados)) {
  if (!ligacao?.id) continue;
  if (ids.length > 0 && !ids.includes(ligacao.id)) continue;

  const fontes = situacaoDasFontes(ligacao);
  for (const f of fontes) contagem[f.situacao] = (contagem[f.situacao] || 0) + 1;

  const aConferir = fontes.filter((f) => incluirConfirmadas || f.situacao !== "confirmada");
  if (aConferir.length === 0) continue;

  saida.push({
    ligacao: ligacao.id,
    arquivo: rel,
    tipo: ligacao.tipo,
    // Numa nota textual não há pontas: a Contraprova recebe o trecho e o
    // título (o que se diz sobre o texto), nunca a descrição argumentada.
    ...(ligacao.entre
      ? {
          pontas: ligacao.entre.map((item) => {
            const [categoria, id] = Object.entries(item)[0];
            return { categoria, id, ...(nomes.get(id) || { ausente: true }) };
          }),
        }
      : { nota: { passagem: ligacao.passagem, versiculos: ligacao.versiculos, titulo: ligacao.titulo } }),
    fontes: aConferir.map(({ hash, nivel, descricao, situacao }) => ({ hash, nivel, descricao, situacao })),
  });
}

if (resumo) {
  const total = Object.values(contagem).reduce((a, b) => a + b, 0);
  console.log(`${total} fonte(s) em ${ids.length || conferiveis(dados).length} ligação(ões) e nota(s):`);
  for (const situacao of ["confirmada", "nao_confirmavel", "contradiz", "desatualizada", "sem_conferencia"]) {
    if (contagem[situacao]) console.log(`  ${situacao}: ${contagem[situacao]}`);
  }
} else {
  console.log(JSON.stringify(saida, null, 2));
}
