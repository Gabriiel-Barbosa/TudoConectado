# Arquitetura — Tudo Conectado

Este documento traduz a metodologia (`metodologia.md`) em uma estrutura técnica concreta: como os dados são guardados, como são validados, como viram um mapa navegável, e como isso chega ao GitHub Pages. Ele não substitui a metodologia — toda regra de conteúdo continua valendo como está lá. Aqui só se decide *onde* e *como* cada regra é aplicada em código.

Este documento já foi implementado — schema, `validar.js`/`compilar.js`, a interface (grafo navegável em Cytoscape.js) e o CI estão rodando contra dados reais de Gênesis. O texto abaixo ainda descreve a arquitetura como decisão de projeto (é a referência de "como isso deve funcionar"), não como um plano futuro.

---

## 1. Visão geral do pipeline

O sistema tem quatro etapas, cada uma alimentando a próxima:

| Etapa | O que faz | Onde vive |
|---|---|---|
| **1. Captura** | Uma pessoa registra um Registro, uma Afirmação ou uma Ligação em um arquivo YAML | Pasta `dados/`, editada à mão |
| **2. Validação** | Um script Node.js recusa qualquer arquivo que não cumpra as regras da metodologia | `scripts/validar.js`, roda no PR |
| **3. Compilação** | Os YAML válidos são combinados em um único grafo (`grafo.json`) e numa timeline | `scripts/compilar.js`, roda no merge |
| **4. Publicação** | Uma página estática lê `grafo.json` e mostra o mapa e as passagens | `docs/`, servido pelo GitHub Pages |

Nenhuma etapa depende de banco de dados externo. Tudo é arquivo de texto no Git, como já decidido na seção 10 da metodologia.

---

## 2. Estrutura de pastas do repositório

```
tudo-conectado/
├── CLAUDE.md                      # regras operacionais para o Claude Code (seção 11)
├── METODOLOGIA.md                 # cópia espelhada de claude/metodologia.md
├── README.md
├── dados/
│   ├── registros/
│   │   ├── pessoa/
│   │   ├── lugar/
│   │   ├── acontecimento/
│   │   ├── texto/
│   │   └── objeto/
│   ├── afirmacoes/
│   ├── ligacoes/
│   └── passagens/
│       └── genesis/
│           ├── gen-01-01_02-03.yaml
│           ├── gen-02-04_02-25.yaml
│           └── ...
├── schema/
│   ├── registro.schema.json
│   ├── afirmacao.schema.json
│   ├── ligacao.schema.json
│   └── passagem.schema.json
├── scripts/
│   ├── validar.js
│   ├── compilar.js
│   └── conferir_citacoes.js
├── docs/                           # site publicado pelo GitHub Pages
│   ├── index.html
│   ├── grafo.json                  # gerado, não editado à mão
│   ├── timeline.json               # gerado, não editado à mão
│   └── assets/
└── .github/
    └── workflows/
        ├── validar.yml              # roda em todo PR
        └── publicar.yml             # roda no merge para main
```

Cada Registro, Afirmação e Ligação é **um arquivo por registro**, não uma lista dentro de um arquivo grande. Isso mantém os diffs do Git pequenos e legíveis — dá para ver exatamente o que mudou em cada revisão, e dá para revisar uma ligação de cada vez.

---

## 3. Formato dos dados

### 3.1 Registro

```yaml
id: senaqueribe
tipo: pessoa            # pessoa | lugar | acontecimento | texto | objeto
nome: Senaqueribe
alias: [Sennacherib, Sin-ahhe-eriba]
descricao: Rei da Assíria, reinou entre 705 e 681 a.C. (segundo a Lista Real Assíria)
```

### 3.2 Afirmação

```yaml
id: cerco-jerusalem-701
texto: "Senaqueribe cercou Jerusalém em 701 a.C."
registros_envolvidos: [senaqueribe, jerusalem]
datacao:
  - periodo: [-701, -701]
    segundo_quem: "Lista Real Assíria; 2 Reis 18-19"
```

### 3.3 Ligação

Campo a campo, mapeado direto na seção 1 e na seção 4 da metodologia — nenhum campo aqui é decoração, cada um existe porque uma regra específica o exige:

```yaml
id: prisma-taylor_confirma_2reis18
tipo: confirma                     # ver tabela de tipos na seção 3 da metodologia
entre:                             # lê-se: entre[0] <tipo> entre[1] (sujeito → alvo)
  - registro: prisma-taylor
  - afirmacao: cerco-jerusalem-701
evidencia:
  tipo_de_apoio: inscricao         # texto | inscricao | achado_arqueologico | moedas | analise_linguistica | nenhum
  forca: bem_estabelecido          # bem_estabelecido | aceito_maioria | disputado | poucos | especulacao
  quem_sustenta:
    - nome: "Mordechai Cogan"
      ano: 2000
fontes:
  - nivel: 1
    descricao: "Prisma de Taylor, coluna III, linhas 18-27"
  - nivel: 2
    descricao: "Cogan, M. (2000), The Raging Torrent, p. 115"
o_que_derrubaria: >
  Evidência de que o Prisma de Taylor descreve um cerco diferente,
  ou de que sua datação não coincide com o reinado de Senaqueribe.
notas: null
```

Regras que o formato já força pela própria estrutura: `fontes` é uma lista — não existe campo "fonte única" — e cada fonte carrega seu `nivel` junto, então não tem como declarar uma ligação sem declarar de onde ela vem. `o_que_derrubaria` é campo obrigatório no schema, não um comentário opcional.

### 3.4 Passagem

```yaml
id: gen-10
referencia: "Gênesis 10:1-32"
afirma:
  - "Javã, Quitim, Mizraim, Assur, Elão, Meseque e Tubal são listados como povos descendentes de Noé"
registros_citados: [javan, quitim, mizraim, assur, elao, meseque, tubal]
paralelos_externos:
  - ligacao: javan_e_jonios
  - ligacao: tubal_e_tabal_assirio
# quando não houver nenhum paralelo, o campo abaixo é obrigatório:
# nenhum_paralelo_conhecido: true
```

O campo `nenhum_paralelo_conhecido` existe para tornar a ausência visível, como pede a seção 11 da metodologia — uma passagem não pode simplesmente não ter o campo preenchido; ou ela lista os paralelos, ou declara explicitamente que não há nenhum.

---

## 4. Convenção de IDs e nomes de arquivo

- IDs são `snake_case`, em português, sem acento e sem espaço: `cerco-jerusalem-701`, `prisma-taylor`.
- O nome do arquivo é sempre o próprio `id` mais `.yaml`: `dados/registros/lugar/jerusalem.yaml`.
- Passagens usam o padrão `gen-<capítulo com dois dígitos>-<versículo inicial>_<capítulo final>-<versículo final>`, ex.: `gen-01-01_02-03.yaml` para Gênesis 1:1–2:3.
- Nenhum ID é reaproveitado nem editado depois de criado — ligações e afirmações referenciam por ID, e um ID que muda quebra tudo que aponta pra ele. Se um nome precisar mudar, o campo `nome` ou `alias` muda; o `id` não.

---

## 5. Validação automática (`scripts/validar.js`)

O script roda em todo Pull Request e recusa o merge se qualquer regra abaixo for violada. Cada linha da tabela aponta para a seção correspondente da metodologia:

| Verificação | Metodologia |
|---|---|
| Todo arquivo tem `tipo` definido dentre os valores permitidos | Seção 3 |
| Toda ligação tem pelo menos uma fonte de nível 1 ou 2 | Seção 6 |
| Toda ligação tem o campo `o_que_derrubaria` preenchido (não vazio) | Seção 8 |
| Ligação do tipo `foi_copiado_de` tem um campo extra `justificativa_copia` preenchendo as três condições (semelhança específica, anterioridade comprovada, caminho plausível) | Seção 3, regra mais importante |
| Toda fonte tem `descricao` com localização exata (capítulo/versículo, coluna/linha, nº de catálogo, página) — recusa fonte só com título do livro | Seção 7 |
| Fonte de nível 4 nunca aparece sozinha como único apoio de uma ligação | Seção 6 |
| Toda `datacao` tem `segundo_quem` preenchido | Seção 5 |
| Toda passagem tem `paralelos_externos` OU `nenhum_paralelo_conhecido: true` — nunca os dois ausentes | Seção 11 |
| IDs referenciados (`registros_envolvidos`, `entre`, etc.) existem de fato como arquivos | integridade referencial |

O que o script **não** consegue verificar — e por isso continua exigindo revisão humana — é se a citação realmente diz o que se afirma que ela diz. Isso é o objeto da seção 7 da metodologia e fica com `scripts/conferir_citacoes.js`, que por enquanto é uma lista de checklist gerada automaticamente (uma linha por fonte citada, para marcar manualmente "conferido: sim/não"), não uma verificação automática de conteúdo.

O schema JSON (`schema/*.schema.json`) implementa a parte estrutural (campos obrigatórios, tipos, enums); `validar.js` implementa as regras que cruzam campos ou arquivos, que um JSON Schema sozinho não expressa.

---

## 6. Compilação do grafo (`scripts/compilar.js`)

Depois que os dados passam na validação, este script lê todos os YAML de `dados/` e gera dois arquivos em `docs/`:

- **`grafo.json`** — nós (Registros e Afirmações) e arestas (Ligações, com `tipo`, `forca` e `fontes` embutidos), no formato que a lib de visualização escolhida consumir.
- **`timeline.json`** — as mesmas Afirmações organizadas por `datacao`, com a margem de período preservada (nunca um ponto único no tempo, conforme seção 5).

Esses dois arquivos **nunca são editados à mão** — são artefato de build, regenerado a cada merge. Isso evita divergência entre os YAML (fonte da verdade) e o que o site mostra.

---

## 7. Publicação no GitHub Pages

Proposta: usar a pasta `docs/` na branch `main` como raiz do GitHub Pages (opção nativa do GitHub, sem precisar de branch `gh-pages` separada nem de build step no Pages em si — o build já aconteceu antes, via Actions).

A página (seção 10 da metodologia já antecipa isso como "fica para depois, pode ser uma página simples") tem três visões, todas lendo `grafo.json`/`timeline.json` estático — sem backend:

1. **Mapa de ligações** — grafo navegável (nós clicáveis, filtro por `tipo` de ligação e por `forca` do apoio).
2. **Linha do tempo** — Afirmações plotadas com sua margem de datação, agrupadas por `segundo_quem` quando há datações concorrentes.
3. **Percurso por passagem** — lista de passagens de Gênesis na ordem do texto, cada uma mostrando o que foi encontrado e, quando for o caso, "nenhum paralelo externo conhecido" — a visão que mais importa para a seção 11 da metodologia (tornar o vazio visível).

Biblioteca de visualização: **Cytoscape.js** (via CDN, sem bundler) para o grafo — nós dimensionados pelo grau de conexão, layout `breadthfirst` radial centralizado no nó clicado, spotlight na vizinhança. A timeline é uma lista vertical em HTML/CSS puro (sem lib), suficiente para o volume atual de dados.

---

## 8. Integração contínua

Dois workflows do GitHub Actions:

- **`validar.yml`** — roda em todo Pull Request. Executa `scripts/validar.js` contra os arquivos alterados. PR não pode ser mesclado se falhar.
- **`publicar.yml`** — roda em todo push para `main`. Executa `scripts/validar.js` (rede de segurança) e depois `scripts/compilar.js`, commitando `grafo.json`/`timeline.json` atualizados de volta em `docs/`. O GitHub Pages publica automaticamente a partir daí.

---

## 9. Como garantir que o Claude Code leia e siga a metodologia

Este é o ponto que motivou o pedido. Duas coisas diferentes estão em jogo e vale separar:

**O que está acontecendo agora** — esta conversa roda dentro do Project "Tudo Conectado" no claude.ai, que já injeta `claude/metodologia.md` como instrução de projeto. É por isso que esta arquitetura já nasce alinhada com as regras.

**O que vai acontecer depois** — quando o repositório existir no GitHub e alguém (você, ou uma sessão futura do Claude Code rodando localmente ou via CI) for gerar código ou dados dentro dele, essa sessão **não tem acesso automático a este Project do claude.ai**. Claude Code lê arquivos do repositório, não a base de conhecimento do claude.ai. Se a metodologia não estiver fisicamente dentro do repositório, uma sessão de Claude Code trabalhando nele não a conhece.

A arquitetura resolve isso com dois arquivos na raiz do repositório:

- **`METODOLOGIA.md`** — cópia espelhada de `claude/metodologia.md`. Continua sendo o texto completo, sem resumir nada. Sempre que a metodologia mudar no Project, esta cópia precisa ser atualizada junto (é uma cópia, não um link — GitHub Pages e Claude Code não leem o Project do claude.ai).
- **`CLAUDE.md`** — arquivo que o Claude Code carrega automaticamente ao abrir o repositório (é a convenção do próprio Claude Code para instruções de projeto). Não repete a metodologia inteira; aponta pra ela e lista as regras operacionais que importam na hora de escrever código ou dados:
  - antes de criar qualquer Ligação, rodar `scripts/validar.js` e não commitar se falhar;
  - nunca inventar uma fonte ou uma localização de citação — se não for possível confirmar que a fonte existe e diz o que se afirma, marcar como pendente de conferência em vez de preencher;
  - respeitar a convenção de IDs da seção 4 deste documento;
  - qualquer ligação do tipo `foi_copiado_de` exige as três condições da seção 3 da metodologia, justificadas explicitamente — nunca aplicar esse tipo "porque parece óbvio";
  - `grafo.json` e `timeline.json` são gerados, nunca editados à mão.

Na prática isso significa: o repositório é autossuficiente. Alguém pode clonar `tudo-conectado` sem nunca ter visto este Project do claude.ai, abrir o Claude Code ali, e ainda assim o agente vai seguir as mesmas regras — porque elas estão no próprio repositório, não só na memória desta conversa.

---

## 10. Decisões em aberto

- Se `dados/passagens/` cobre só Gênesis por enquanto ou já prevê outros livros na estrutura de pastas (proposta atual: só criar `genesis/` agora; outras pastas nascem quando o percurso chegar lá, para não desenhar estrutura sem conteúdo).
- Formato exato de `conferir_citacoes.js` — se vira um checklist em Markdown gerado, uma issue do GitHub por citação, ou uma planilha à parte.
- Se a entrada de dados continua só por arquivo (edição direta/Claude Code) ou se em algum momento ganha um formulário no próprio site escrevendo via API do GitHub — decidido por ora como "só arquivo" (mais simples, sem autenticação).

## 11. Próximos passos sugeridos

1. Preencher `METODOLOGIA.md` (ainda é só um placeholder) — sem o texto completo da metodologia, `validar.js` não pode ser conferido contra as regras reais de força de evidência, tipos de ligação e datação.
2. Expandir os dados reais de Gênesis além da autoria (seguir pela seção 12 da metodologia — Gênesis 10 é o trecho com mais apoio externo, segundo a arquitetura original).
3. Cada Registro/Afirmação/Ligação nova passa por `npm run validar` e `npm test` antes de commitar (ver `CLAUDE.md`).
