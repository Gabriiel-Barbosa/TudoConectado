# Guia de estilo — textos do Tudo Conectado

Vale para todo texto que um visitante lê: os campos de prosa em `dados/` e
as frases fixas da interface (`docs/assets/app.js`, `docs/index.html`). A
regra de cima vence a de baixo quando duas entram em conflito.

## Sumário
0. [Para quem escrevemos](#0-para-quem-escrevemos)
1. [Fidelidade: reescrever não é acrescentar](#1-fidelidade-reescrever-não-é-acrescentar)
2. [Autoria própria: nada de plágio](#2-autoria-própria-nada-de-plágio)
3. [Didática](#3-didática)
4. [Norma e gramática](#4-norma-e-gramática)
5. [Convenções do projeto](#5-convenções-do-projeto)
6. [Campo a campo](#6-campo-a-campo)
7. [Textos da interface](#7-textos-da-interface)

## 0. Para quem escrevemos

O mesmo texto é lido por um especialista em crítica bíblica e por alguém
que nunca ouviu a palavra "Pentateuco". Os dois precisam sair entendendo.

- **Em camadas.** A primeira frase serve a quem não sabe nada: diz o que a
  coisa é, em palavras comuns. As frases seguintes trazem o detalhe que o
  especialista procura (siglas, nomes, datas, a discussão).
- **Nada fica pressuposto.** Todo termo técnico, sigla, nome de obra e
  nome de pessoa que um leigo não reconheceria ganha, na primeira vez, uma
  explicação curta (ver "glosa", seção 1).
- **Teste do leigo.** Releia o texto como alguém que só sabe que a Bíblia
  existe. Se uma frase exige saber algo que o texto não disse, ela precisa
  de uma glosa ou precisa ser dividida.
- **Teste do especialista.** Nada pode ficar errado nem vago por ter sido
  simplificado. Simplifique a frase, e não o fato.

Exemplo de antes e depois (Hipótese Documentária):

> **Antes:** Teoria de crítica bíblica segundo a qual o Pentateuco resulta
> da combinação de quatro fontes distintas — Javista (J), Eloísta (E),
> Sacerdotal (P) e Deuteronomista (D) — compiladas e editadas ao longo de
> séculos, em vez de escritas por um único autor.
>
> **Depois:** Explicação acadêmica de como os cinco primeiros livros da
> Bíblia (o Pentateuco, de Gênesis a Deuteronômio) foram escritos. Em vez de
> um único autor, ela propõe quatro textos independentes, que foram reunidos
> e editados ao longo de séculos até formar os livros que conhecemos. Os
> estudiosos chamam esses textos de "fontes" e dão a cada um um nome e uma
> letra: Javista (J), Eloísta (E), Sacerdotal (P, do inglês *Priestly*) e
> Deuteronomista (D).

Repare que o "depois" não traz nenhuma afirmação nova sobre a hipótese.
Ele só explica o que "Pentateuco" e "fonte" querem dizer.

### Narrativa histórica, não anotação

Todo campo de prosa é lido **sozinho**, num card, por quem não viu o resto
do arquivo. Por isso cada texto conta um pedaço de história completo: quem
fez o quê, quando, e por que isso importa para o que está sendo mostrado.
Nada de frase solta que só faz sentido para quem já sabe do que se trata.

- **Sujeito e objeto explícitos.** Não "A faixa é ampla porque…" (faixa de
  quê?), e sim "Pela cronologia tradicional, Moisés teria escrito Gênesis
  entre c. 1446 e 1200 a.C.". Diga sempre o que está sendo datado,
  confirmado ou contestado, pelo nome.
- **Comece pelo acontecimento, depois a explicação.** Primeiro o que se
  diz que aconteceu, e quando; em seguida por que a data ou a evidência é
  essa; por fim o limite ou a discussão.
- **Tom de relato histórico.** Frases que situam o leitor no tempo e no
  lugar: "No século III a.C., um escriba copiou…", "Séculos depois, os
  rabinos da Babilônia registraram…". Só com fatos que o arquivo ou as
  fontes registradas sustentam.
- **A narrativa não apaga a atribuição.** Contar como história não é
  transformar tradição ou hipótese em fato do narrador. Use o condicional
  ou o "segundo quem" quando a afirmação é de alguém: "Segundo a tradição
  judaica e cristã, Moisés teria escrito…", "Os estudiosos que seguem a
  Hipótese Documentária propõem…". Nunca "Moisés escreveu Gênesis em 1446
  a.C.". "Estima-se" só quando o arquivo registra quem estima.
- **Os números do próprio arquivo podem e devem ir para o texto.** Se a
  `datacao` tem `periodo: [-1446, -1200]`, o `segundo_quem` pode dizer "entre
  c. 1446 e 1200 a.C.": não é fato novo, é o mesmo dado escrito por extenso.

Exemplo de antes e depois (datação da afirmação "Gênesis foi escrito por
Moisés", `periodo: [-1446, -1200]`):

> **Antes:** A cronologia tradicional. A faixa é ampla porque a própria
> tradição se divide entre duas datações. A "alta", por volta do século XV
> a.C., vem de uma leitura literal de 1 Reis 6:1. […]
>
> **Depois:** Pela cronologia tradicional, Moisés teria escrito Gênesis
> entre c. 1446 e 1200 a.C. O intervalo é largo porque a própria tradição
> não chega a uma data só. Quem lê ao pé da letra 1 Reis 6:1 põe o Êxodo, a
> saída dos israelitas do Egito, por volta do século XV a.C.; quem o
> associa ao reinado do faraó Ramessés II o desloca para o século XIII a.C.

O "depois" não acrescenta nada: o intervalo estava no `periodo`, e as duas
datações já estavam no texto. Ele só diz, logo de saída, o que está sendo
datado e segundo quem.

## 1. Fidelidade: reescrever não é acrescentar

- **Nenhum fato novo sobre o assunto.** Datas, números, nomes, lugares,
  atribuições e qualificadores ("a mais antiga", "a maioria dos
  estudiosos") só aparecem se já estavam no texto original ou numa fonte
  registrada no mesmo arquivo. Se você acha que falta um fato, anote como
  sugestão. Não escreva o fato.
- **Glosa de termo é permitida, com limite.** Explicar o que uma palavra
  quer dizer é permitido quando a explicação é consensual e não carrega
  nada disputado. Exemplos: "Pentateuco (os cinco primeiros livros da
  Bíblia)", "paleográfica (pelo estilo da letra)", "Qumran (sítio junto ao
  Mar Morto)". Uma glosa **não** pode trazer data, autoria, número,
  avaliação nem nada que alguém conteste. Se a explicação precisaria de
  fonte, ela não é glosa: é fato novo, e vira sugestão. Toda glosa
  acrescentada vai listada no relatório para revisão humana.
- **As fontes continuam citadas.** Autores e obras que o texto já menciona
  ("formalizada por Wellhausen", "segundo Crawford (2012)") ficam, com o
  ano. Se a obra está nas `fontes` de uma ligação, use a mesma referência.
  Explicar melhor nunca pode apagar quem disse o quê.
- **Mesma força.** Uma reescrita não deixa a afirmação mais forte nem mais
  fraca. "Datado entre 250 e 150 a.C." não vira "do século III a.C.". "É
  disputado" não vira "é falso".
- **Interpretação continua atribuída.** O que é leitura de alguém ("segundo
  a tradição", "segundo Crawford (2012)") mantém o "segundo quem" (seção 5
  da metodologia). Nunca transforme uma atribuição em fato do narrador.
- **Na dúvida, não mexa.** Se reescrever uma frase exigiria entender melhor o
  assunto do que o texto permite, mantenha a frase e registre a dúvida no
  relatório.

## 2. Autoria própria: nada de plágio

O projeto cita fontes. Não copia fontes.

- **Escreva com as suas palavras.** Não reproduza a estrutura de frase de
  uma obra, de uma enciclopédia ou de um site, nem mesmo traduzida. Uma
  tradução literal de um parágrafo alheio é cópia.
- **Limite de coincidência:** fora nomes próprios, títulos de obras e termos
  técnicos consagrados, nenhuma sequência de **8 palavras ou mais** pode
  coincidir com um texto publicado.
- **Citação direta** só entre aspas, com autor, obra e localização (página,
  fólio, coluna), com **no máximo 25 palavras** e **no máximo uma por
  campo**. Se a citação não tem localização registrada em `fontes`, ela não
  entra.
- **Checagem:** para cada frase que pareça "pronta demais" (tom de
  enciclopédia, ritmo de tradução), pesquise o trecho exato entre aspas.
  Se aparecer publicado, reescreva do zero, sem partir da frase encontrada.
- Wikipédia e sites não especializados não são fonte (CLAUDE.md), e também
  não são modelo de redação: não parta do texto deles.

## 3. Didática

O leitor é curioso e inteligente, mas não é especialista.

- **Do geral para o específico.** A primeira frase diz o que a coisa é. Os
  detalhes vêm depois. Ex.: "Fragmento de manuscrito de Gênesis. […]" antes
  da gruta, da escrita e da datação.
- **Uma ideia por frase.** Frases com mais de ~30 palavras quase sempre se
  dividem em duas.
- **Termo técnico explicado na primeira ocorrência**, em poucas palavras:
  "paleo-hebraica (a escrita hebraica antiga, anterior à quadrada)". Só
  explique com o que o próprio texto ou uma fonte registrada sustenta.
- **Sigla por extenso na primeira vez:** "Hipótese Documentária (JEDP)" já
  está certo. "JEDP" sozinho, não.
- **Sem referência cruzada crua.** Nunca "(ver hipotese-documentaria)". O
  leitor vê o nome, não o id: "(ver Hipótese Documentária)". A interface já
  mostra as conexões, então a remissão raramente é necessária.
- **Concreto antes de abstrato.** "Encontrado na Gruta 6 de Qumran" diz mais
  do que "de proveniência qumrânica".

## 4. Norma e gramática

- **Português do Brasil, norma culta**, Acordo Ortográfico de 1990 (em vigor
  desde 2009): "ideia", "paleo-hebraico", "autoatribuição".
- **Crase, regência e concordância** conferidas frase a frase. Os erros mais
  comuns aqui são concordância com sujeito posposto ("são disputadas a
  existência e a autoria") e crase antes de datas e numerais ("a partir de
  250 a.C.", sem crase).
- **Voz ativa** sempre que o agente for conhecido. A passiva fica para
  quando o agente é desconhecido ou irrelevante ("foi encontrado em 1952").
- **Tom neutro e descritivo.** Sem adjetivos de valor ("fascinante",
  "misterioso", "polêmico"), sem ironia e sem tomar partido numa disputa.
  Disputas se descrevem: quem diz o quê.
- **Pontuação:** prefira vírgula e parênteses. Use travessão (—), com espaço
  dos dois lados, **no máximo um par por campo**. Meia-risca (–) sem espaço
  em intervalos: "6:13–21", "250–150 a.C.". Aspas curvas ("…" e '…') nos
  textos novos. Evite a barra em datas ("1878/1883"). Diga o que cada data
  é, se o texto disser.

### Voz: professor, não resumo

A voz de referência é a de um bom texto acadêmico de divulgação, ou de um
professor explicando para a turma: preciso, mas conversado. Não é a voz de
verbete formal nem a de resumo gerado por máquina.

Marcas de texto gerado por IA, que **não** podem aparecer:
- travessões em série e frases montadas em blocos simétricos;
- enumerações de três por hábito ("claro, preciso e acessível");
- muletas: "é importante destacar", "vale ressaltar", "nesse sentido",
  "desempenha um papel", "em suma", "de forma geral", "rico e complexo";
- frase final que resume o que acabou de ser dito;
- dois-pontos introduzindo tudo e adjetivos sempre em pares;
- todas as frases com o mesmo tamanho e o mesmo ritmo.

O que fazer no lugar:
- verbos concretos ("juntaram", "copiaram", "encontraram") em vez de
  abstrações ("resulta da combinação");
- frases de tamanhos diferentes, e uma frase curta de vez em quando;
- quando ajudar, um exemplo tirado do próprio texto ou das fontes
  registradas, sem inventar exemplo;
- sujeito humano sempre que houver ("Wellhausen propôs", e não "foi
  proposta a formalização").

## 5. Convenções do projeto

- **Datas:** "a.C." e "d.C.", com espaço antes: "701 a.C.". Séculos em
  algarismos romanos: "século III a.C.". Aproximação com "c." ou "por volta
  de", e nunca "~" em texto corrido. O "~" pode ficar num parêntese
  técnico.
- **Referências bíblicas:** "Gênesis 6:13–21" por extenso no texto corrido.
  "Gn 6:13–21" só em lista ou tabela.
- **Nomes:** a forma portuguesa consagrada ("Moisés", "Qumran", "Talmude
  Babilônico"), com o original em `alias` e não no meio da frase.
- **Obras:** título em itálico não existe em YAML. Use o título como está,
  sem aspas, e autor e ano entre parênteses: "Crawford (2012)".

## 6. Campo a campo

| campo | pode reescrever? | cuidado |
|---|---|---|
| `registro.descricao` | sim | 2 a 6 frases. A primeira define para o leigo; as outras aprofundam. |
| `afirmacao.texto` | **não** | É a afirmação que as ligações julgam. Mudar o texto muda o que foi conferido. Só sugira. |
| `datacao[].segundo_quem` | sim, com cuidado | Frase inteira que diz o que é datado, quando e segundo quem ("Pela cronologia tradicional, Moisés teria escrito Gênesis entre c. 1446 e 1200 a.C."), usando o `periodo` do arquivo; depois a justificativa. Nunca remova a justificativa. |
| `ligacao.notas` | sim | Diz o que a evidência **não** demonstra, contado como narrativa: o que a evidência é, o que ela mostra e onde ela para. Não pode virar argumento a favor. |
| `ligacao.o_que_derrubaria` | sim | Uma condição concreta e verificável, e não "se surgirem novas evidências". Nomeie a ligação pelo que ela diz ("A ideia de que o 6QpaleoGen é uma cópia de Gênesis cairia se…"), e não "Esta ligação". |
| `justificativa_copia.*` | só gramática | Qualquer mudança de conteúdo precisa de nova conferência. |
| `fontes[].descricao` | **não** | É bibliografia conferida. Qualquer mudança invalida o veredito da Contraprova. |
| `id`, `tipo`, `entre`, `forca`, `nivel`, `quem_sustenta` | **não** | Estrutura, não texto. |

## 7. Textos da interface

- Plural de verdade, com `plural(n, singular, plural)` em `app.js`, e nunca
  "(s)" ou "(ões)".
- Nunca exibir um id ao leitor. Use `rotuloDoNo`, `rotuloPorId` ou
  `rotuloLigacao`.
- Rótulos de valores do schema só nos mapas existentes (`ROTULO_FORCA`,
  `ROTULO_APOIO`, `ROTULO_CATEGORIA`). A interface não inventa conteúdo (ver
  `convencoes-frontend.md`, seção "Conteúdo").
- Frases curtas, no presente, sem jargão interno ("aresta", "nó estrutural",
  "hash"). "Ligação estrutural" pode, com a explicação no `title`.
