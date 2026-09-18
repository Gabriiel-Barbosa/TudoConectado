# Guia de ligação

A ligação é o que dá sentido ao projeto: é ela que carrega a evidência.
Também é onde o risco de fabricação é maior. Leia este guia inteiro antes de
redigir uma ligação.

> Enquanto `METODOLOGIA.md` for um placeholder, as definições formais de
> tipos (seção 3), força e níveis de fonte (seção 6) e localização (seção 7)
> **não existem por escrito**. Este guia usa só o que está em
> `arquitetura-tudo-conectado.md`, nos schemas e nos dados existentes, e diz
> explicitamente quando uma decisão precisa do usuário.

## Tipo (`tipo`)

O schema aceita qualquer texto, mas a interface cria filtros e cores a
partir dos tipos que aparecem nos dados. Um tipo novo muda a interface.

- Tipos já em uso: `confirma`, `contradiz`. Rode
  `grep -h "^tipo:" dados/ligacoes/*.yaml | sort | uniq -c` para ver a lista
  atual.
- `foi_copiado_de` está previsto no schema, com regras próprias (abaixo).
- **Tipo novo exige confirmação explícita do usuário**, com a justificativa
  de por que nenhum tipo existente serve.

**Direção:** leia a ligação como "`entre[0]` *tipo* `entre[1]`". Por
exemplo, `hipotese-documentaria` contradiz `autoria-mosaica-genesis`. A
aresta do grafo é compilada nessa ordem.

## Força (`evidencia.forca`)

Valores: `bem_estabelecido`, `aceito_maioria`, `disputado`, `poucos`,
`especulacao`.

A força mede o **estado do consenso na comunidade relevante**, não a sua
opinião. Proponha um valor, justifique em uma frase e deixe o usuário
decidir.

Quando a força valer dentro de uma comunidade específica, diga isso em
`notas`. Os dados existentes fazem isso: `talmude-confirma-autoria-mosaica`
tem `aceito_maioria` *dentro da tradição rabínica*, e a nota explica que isso
não avalia a força histórica. Escreva essa nota sempre que a ligação
envolver tradição religiosa ou escola acadêmica.

## Tipo de apoio (`evidencia.tipo_de_apoio`)

`texto`, `inscricao`, `achado_arqueologico`, `moedas`,
`analise_linguistica` ou `nenhum`. Descreve a **natureza da evidência**, não
a da fonte que a relata. Um artigo de periódico que analisa uma inscrição
tem apoio `inscricao`.

## Fontes (`fontes[]`)

Cada fonte tem `nivel` (1–4) e `descricao`.

**Níveis:** a arquitetura (§3.3) exemplifica o nível 1 com o objeto ou texto
primário ("Prisma de Taylor, coluna III, linhas 18-27") e o nível 2 com
bibliografia acadêmica sobre ele ("Cogan, M. (2000), The Raging Torrent,
p. 115"). **Os níveis 3 e 4 não estão definidos em nenhum arquivo do
repositório.** Não os use sem que o usuário diga o que significam, e nunca
deduza a definição.

Regras que `validar.js` já aplica:
- pelo menos uma fonte de nível 1 ou 2;
- uma fonte de nível 4 nunca como único apoio.

**Descrição com localização exata.** Essa é a regra que o `validar.js`
**ainda não aplica** (o schema só exige texto não vazio), então quem aplica
é você. A descrição precisa ter um destes:

| tipo de fonte | localização exigida | exemplo |
|---|---|---|
| livro ou artigo | página(s) | `Cogan, M. (2000), The Raging Torrent, p. 115` |
| texto bíblico | capítulo:versículo | `2 Reis 18:13–16` |
| Talmude | tratado e fólio | `Bava Batra 14b–15a` |
| inscrição | coluna/linha | `Prisma de Taylor, coluna III, linhas 18–27` |
| objeto em acervo | instituição e nº de catálogo | `British Museum, BM 91032` |
| manuscrito | sigla/catálogo | `6Q1 (6QpaleoGen)` |

Três fontes nos dados atuais não têm página (Wellhausen 1883, Baden 2012,
Crawford 2012). Não as use como modelo. O `/lacunas` as lista.

**Fontes admissíveis:** editoras universitárias, arquivos oficiais,
catálogos de museus, periódicos revisados por pares e edições críticas.
Nunca Wikipédia ou sites não especializados.

## Quem sustenta (`evidencia.quem_sustenta[]`)

Pesquisadores que defendem a ligação, com `nome` e `ano` (inteiro) da obra
em que o fazem. Pode ser `[]` quando a sustentação é a própria tradição (como
em `talmude-confirma-autoria-mosaica`). Nome e ano são **fatos**: vêm do
usuário ou de uma obra conferida, e nunca da memória.

## O que derrubaria (`o_que_derrubaria`)

Campo obrigatório e o mais importante para a honestidade do projeto: diz
qual evidência **concreta** faria a ligação cair. Você redige, e o usuário
revisa.

- Bom: *"Nova análise paleográfica que revise a datação do fragmento para um
  período significativamente posterior."* Diz que evidência seria e que
  resultado ela teria.
- Ruim: *"Novas descobertas."* ou *"Se estiver errado."* Não é falseável.

## `foi_copiado_de`: a regra mais importante

Nunca aplique este tipo porque "parece óbvio". O schema exige
`justificativa_copia` com os três campos, e **cada um precisa ser
sustentado por fonte nesta mesma ligação**:

```yaml
justificativa_copia:
  semelhanca_especifica: >
    O que é igual, no detalhe, e por que não é tema comum a qualquer cultura
    (ex.: mesma sequência de eventos E mesmo detalhe incomum), não
    "ambos têm um dilúvio".
  anterioridade_comprovada: >
    Datação da fonte copiada, com a faixa e quem data — anterior à mais
    antiga datação plausível da cópia.
  caminho_plausivel: >
    Como o texto chegou de um contexto ao outro (contato histórico
    documentado, período de exílio, escola de escribas...).
```

Se **qualquer** uma das três não tiver fonte, a ligação não é
`foi_copiado_de`. Uma semelhança sem cópia comprovada pede um tipo mais
fraco. Se nenhum tipo existente nos dados servir, discuta com o usuário
antes de criar um novo.
Antes de gravar, mostre as três condições ao usuário separadamente e peça
confirmação de cada uma.

## Notas (`notas`)

Obrigatório no schema, mas pode ser `null`. Use para: o escopo da força
(ver acima), o limite do que a evidência mostra (ex.: "a cópia mais antiga
*conhecida*, não a mais antiga que existiu") e a ligação que trata o outro
lado da questão.
