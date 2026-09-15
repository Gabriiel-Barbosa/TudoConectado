# Tudo Conectado

Um mapa de ligações entre Registros (pessoas, lugares, acontecimentos, textos, objetos) documentados em Gênesis, apoiado em fontes primárias e evidência externa. Cada afirmação e cada ligação carrega sua fonte, a força do seu apoio, e o que a derrubaria — nada entra no grafo sem isso.

A metodologia completa está em [`METODOLOGIA.md`](METODOLOGIA.md); a arquitetura técnica que implementa essa metodologia está em [`arquitetura-tudo-conectado.md`](arquitetura-tudo-conectado.md).

## Pipeline

```
dados/*.yaml  →  scripts/validar.js  →  scripts/compilar.js  →  docs/ (grafo.json, timeline.json)  →  GitHub Pages
```

1. **Captura** — cada Registro, Afirmação e Ligação é um arquivo YAML em `dados/`.
2. **Validação** — `scripts/validar.js` recusa qualquer arquivo que não cumpra as regras da metodologia.
3. **Compilação** — `scripts/compilar.js` combina os YAML válidos em `docs/grafo.json` e `docs/timeline.json`.
4. **Publicação** — `docs/index.html` lê os JSON gerados e mostra o grafo navegável (Cytoscape.js), a timeline e o percurso por passagem. Site estático puro, sem backend.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `dados/registros/<tipo>/` | Pessoas, lugares, acontecimentos, textos, objetos |
| `dados/afirmacoes/` | Afirmações datadas, cada uma ligando um ou mais registros |
| `dados/ligacoes/` | Ligações entre afirmações e registros, com evidência e fontes |
| `dados/passagens/genesis/` | Passagens de Gênesis e seus paralelos externos (ou a ausência declarada deles) |
| `schema/` | JSON Schema de cada tipo de arquivo em `dados/` |
| `scripts/` | Validação, compilação do grafo, checklist de citações e seus testes (Node.js) |
| `docs/` | Site estático publicado (gerado; `grafo.json`/`timeline.json` não são editados à mão) |

## Uso local

```bash
npm install
npm run validar          # valida tudo em dados/
npm run compilar         # gera docs/grafo.json e docs/timeline.json
npm test                 # roda os testes unitários de scripts/
npm run conferir-citacoes   # gera checklist de citações a conferir
```

Pra ver o site localmente: `cd docs && python -m http.server 8000` (ou qualquer servidor estático) e abra `http://localhost:8000`.

## Estado atual

Primeiro conteúdo real carregado: autoria de Gênesis (tradição mosaica vs. Hipótese Documentária) e o manuscrito mais antigo conhecido do livro (6QpaleoGen, Rolos do Mar Morto). Ver seção 11 de `arquitetura-tudo-conectado.md` para os próximos passos — a metodologia completa (`METODOLOGIA.md`) ainda está pendente de preenchimento.
