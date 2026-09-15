# Tudo Conectado

Um mapa de ligações entre Registros (pessoas, lugares, acontecimentos, textos, objetos) documentados em Gênesis, apoiado em fontes primárias e evidência externa. Cada afirmação e cada ligação carrega sua fonte, a força do seu apoio, e o que a derrubaria — nada entra no grafo sem isso.

A metodologia completa está em [`METODOLOGIA.md`](METODOLOGIA.md); a arquitetura técnica que implementa essa metodologia está em [`arquitetura-tudo-conectado.md`](arquitetura-tudo-conectado.md).

## Pipeline

```
dados/*.yaml  →  scripts/validar.py  →  scripts/compilar.py  →  docs/ (grafo.json, timeline.json)  →  GitHub Pages
```

1. **Captura** — cada Registro, Afirmação e Ligação é um arquivo YAML em `dados/`.
2. **Validação** — `scripts/validar.py` recusa qualquer arquivo que não cumpra as regras da metodologia.
3. **Compilação** — `scripts/compilar.py` combina os YAML válidos em `docs/grafo.json` e `docs/timeline.json`.
4. **Publicação** — `docs/index.html` lê os JSON gerados e mostra o mapa, a timeline e o percurso por passagem.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `dados/registros/<tipo>/` | Pessoas, lugares, acontecimentos, textos, objetos |
| `dados/afirmacoes/` | Afirmações datadas, cada uma ligando um ou mais registros |
| `dados/ligacoes/` | Ligações entre afirmações e registros, com evidência e fontes |
| `dados/passagens/genesis/` | Passagens de Gênesis e seus paralelos externos (ou a ausência declarada deles) |
| `schema/` | JSON Schema de cada tipo de arquivo em `dados/` |
| `scripts/` | Validação, compilação do grafo e checklist de citações |
| `docs/` | Site estático publicado (gerado; `grafo.json`/`timeline.json` não são editados à mão) |

## Uso local

```bash
pip install -r requirements.txt
python scripts/validar.py        # valida tudo em dados/
python scripts/compilar.py       # gera docs/grafo.json e docs/timeline.json
python scripts/conferir_citacoes.py   # gera checklist de citações a conferir
```

## Estado atual

Estrutura inicial do projeto. Nenhum dado real de Gênesis foi carregado ainda — ver seção 11 de `arquitetura-tudo-conectado.md` para os próximos passos.
