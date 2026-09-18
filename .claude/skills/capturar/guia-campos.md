# Guia de campos — quem pode fornecer cada um

Legenda da coluna **origem**:
- **usuário**: só o usuário fornece. Você pode perguntar, mas nunca preencher.
- **conferido**: vem de uma obra que passou pela Contraprova.
- **você**: você redige ou estrutura, e o usuário revisa antes de gravar.

A referência estrutural é sempre `schema/<categoria>.schema.json`. Este guia
não repete o schema: diz de onde vem o conteúdo de cada campo.

## Sumário
- [Registro](#registro)
- [Afirmação](#afirmação)
- [Ligação](#ligação) (detalhes em guia-ligacao.md)
- [Passagem](#passagem)

## Registro

| campo | obrigatório | origem | observação |
|---|---|---|---|
| `id` | sim | você | via `checar-id.js`; só `[a-z0-9-]` (o schema de registro **não** aceita `_`) |
| `tipo` | sim | você | `pessoa`, `lugar`, `acontecimento`, `texto` ou `objeto`; define a pasta |
| `nome` | sim | usuário ou você | forma usual em português, com acento |
| `alias` | não | usuário ou conferido | grafias em outras línguas/tradições; ajuda a busca e evita duplicatas |
| `descricao` | sim | você, com base em fato conferido | ver abaixo |

A `descricao` identifica a entidade. Não é lugar de tese. Qualquer data ou
fato que ela contenha precisa estar sustentado em outro lugar do grafo ou
vir do usuário, como o reinado em "Rei da Assíria, reinou entre 705 e 681
a.C. (segundo a Lista Real Assíria)". Se não houver sustentação, deixe a
descrição mais genérica em vez de afirmar.

## Afirmação

| campo | obrigatório | origem | observação |
|---|---|---|---|
| `id` | sim | você | só `[a-z0-9-]` |
| `texto` | sim | você | uma frase verificável, neutra, que pode ser verdadeira ou falsa |
| `registros_envolvidos` | sim (≥1) | você | IDs que **já existem**; crie os registros antes |
| `datacao[].periodo` | sim | usuário ou conferido | `[início, fim]` em anos inteiros; negativo = a.C. |
| `datacao[].segundo_quem` | sim | usuário ou conferido | quem data assim, e por quê, quando a faixa for larga |

**Texto:** escreva a afirmação como a tradição ou a fonte a sustenta, sem
qualificar ("Gênesis foi escrito por Moisés.", não "Supostamente..."). A
força e a contestação ficam nas ligações.

**Datação:** a seção 5 da metodologia proíbe ponto único no tempo. Prefira
faixas. Se `início == fim`, confirme com o usuário que a fonte dá mesmo
precisão anual (ex.: um ano de reinado documentado) e diga isso em
`segundo_quem`. Datações concorrentes são **itens separados** na lista, um
por `segundo_quem`. Nunca faça a média entre elas.

## Ligação

| campo | obrigatório | origem |
|---|---|---|
| `id` | sim | você (`<a>-<tipo>-<b>`) |
| `tipo` | sim | usuário, com a sua proposta |
| `entre` | sim (≥2) | você; IDs que já existem, cada item com `registro:` **ou** `afirmacao:` |
| `evidencia.tipo_de_apoio` | sim | você propõe, usuário confirma |
| `evidencia.forca` | sim | usuário, com a sua proposta justificada |
| `evidencia.quem_sustenta[]` | sim (pode ser `[]`) | conferido: nome e ano reais |
| `fontes[]` | sim (≥1) | conferido |
| `o_que_derrubaria` | sim | você redige, usuário revisa |
| `notas` | sim (pode ser `null`) | você redige, usuário revisa |
| `justificativa_copia` | só em `foi_copiado_de` | ver guia-ligacao.md |

Detalhes e armadilhas: [guia-ligacao.md](guia-ligacao.md).

## Passagem

| campo | obrigatório | origem | observação |
|---|---|---|---|
| `id` | sim | você | `gen-CC-VV_CC-VV` com dois dígitos, ex.: `gen-01-01_02-03` = Gn 1:1–2:3 |
| `referencia` | sim | você | ex.: `"Gênesis 1:1–2:3"`; deve bater com o ID |
| `afirma` | sim (≥1) | você | o que **o texto diz**, parafraseado sem interpretação |
| `registros_citados` | sim (pode ser `[]`) | você | entidades nomeadas no trecho |
| `afirmacoes_citadas` | não | você | afirmações formais que o trecho sustenta |
| `paralelos_externos[]` | um dos dois | você | `- ligacao: <id>` de ligações que já existem |
| `nenhum_paralelo_conhecido` | um dos dois | usuário | `true`, e só quando se sabe que não há paralelo |

**`afirma`** descreve o texto, não a história. Escreva "Javã é listado como
filho de Jafé", e não "Javã foi o ancestral dos jônios". A segunda frase é
uma afirmação que pede uma ligação com evidência.

**Paralelo ou vazio:** o schema exige exatamente um dos dois
(`paralelos_externos` ou `nenhum_paralelo_conhecido: true`). Declarar
"nenhum paralelo" é uma afirmação sobre o estado do conhecimento. Só faça
isso se o usuário confirmar. Se ninguém pesquisou ainda, a passagem
simplesmente não é criada até que alguém pesquise.

**Versificação:** a numeração de versículos varia entre tradições (ex.:
Gn 31:55 na numeração cristã = Gn 32:1 na hebraica). Use a numeração que o
usuário indicar e, se houver divergência conhecida no trecho, diga qual
tradição foi usada em `referencia`.
