# Instruções para o Claude Code — Tudo Conectado

Este projeto segue à risca `METODOLOGIA.md` (regras de conteúdo) e `arquitetura-tudo-conectado.md` (como isso vira código). Leia os dois antes de criar ou editar qualquer arquivo em `dados/`, `schema/` ou `scripts/`. Este arquivo não repete essas regras — só lista o que importa na hora de operar.

## Regras operacionais

- Antes de commitar qualquer Registro, Afirmação ou Ligação nova, rodar `python scripts/validar.py`. Não commitar se falhar.
- Nunca inventar uma fonte, uma citação ou a localização exata de uma citação (capítulo/versículo, coluna/linha, nº de catálogo, página). Se não for possível confirmar que a fonte existe e diz o que se afirma que ela diz, marcar como pendente de conferência em vez de preencher.
- Toda ligação do tipo `foi_copiado_de` exige as três condições da metodologia (semelhança específica, anterioridade comprovada, caminho plausível), justificadas explicitamente em `justificativa_copia` — nunca aplicar esse tipo "porque parece óbvio".
- `docs/grafo.json` e `docs/timeline.json` são gerados por `scripts/compilar.py` — nunca editar esses dois arquivos à mão.
- IDs são `snake_case`/`kebab-case`, em português, sem acento e sem espaço, e nunca são reaproveitados nem editados depois de criados (ver seção 4 da arquitetura). Se um nome muda, edita-se `nome`/`alias`, nunca o `id`.
- Cada Registro, Afirmação, Ligação e Passagem é um arquivo por registro em `dados/` — nunca uma lista dentro de um arquivo grande.

## Onde estão as regras de conteúdo

- Tipos de ligação, força de evidência, níveis de fonte: `METODOLOGIA.md`, seções 3, 6 e 7.
- Datação com margem de incerteza (nunca ponto único no tempo): seção 5.
- Passagens sem paralelo externo devem declarar isso explicitamente (`nenhum_paralelo_conhecido: true`): seção 11.

## Estado do repositório

Scaffold inicial — ver seção 11 de `arquitetura-tudo-conectado.md` para os próximos passos (schema + `validar.py` testados contra 2-3 ligações reais de Gênesis 10 antes de generalizar).
