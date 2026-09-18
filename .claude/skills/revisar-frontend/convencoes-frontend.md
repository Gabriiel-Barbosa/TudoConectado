# Convenções da interface (docs/)

Extraídas do código atual e do histórico de correções. Quando uma regra
nasceu de um bug, o commit está indicado. Rode `git show <commit>` para ver
o caso.

## Sumário
- [Arquitetura](#arquitetura)
- [Segurança: texto dos dados](#segurança-texto-dos-dados)
- [Visibilidade e estados](#visibilidade-e-estados)
- [Cytoscape](#cytoscape)
- [Cores, ícones e tema](#cores-ícones-e-tema)
- [Celular](#celular)
- [Acessibilidade e movimento](#acessibilidade-e-movimento)
- [Conteúdo: a interface não inventa](#conteúdo-a-interface-não-inventa)
- [Cache](#cache)

## Arquitetura

- Site estático: `index.html` + `assets/app.js` + `assets/estilo.css`. Sem
  bundler, sem framework e sem etapa de build para a interface.
- Única dependência externa: **Cytoscape.js via CDN jsdelivr, com versão
  fixada** (`cytoscape@3.34.3`). Lib nova ou mudança de versão só com
  pedido do usuário.
- A interface **só lê** `grafo.json` e `timeline.json`. Nunca edite esses
  arquivos para testar algo. Use uma cópia em diretório temporário.
- Todo o texto visível em **pt-BR**.

## Segurança: texto dos dados

- Qualquer texto vindo dos dados que vá para `innerHTML` passa por
  `escapar()` (`app.js`). Hoje há mais de dez usos de `innerHTML`. Ao
  adicionar um, confira que todo valor interpolado está escapado.
- IDs podem ir para atributos sem escape só porque os schemas restringem o
  padrão a `[a-z0-9_-]`. Qualquer outro campo precisa de escape.

## Visibilidade e estados

- `[hidden] { display: none !important; }` em `estilo.css`. Nunca remova
  o `!important`: uma classe com `display: flex` fazia o `hidden` não
  esconder nada (**2784c48**).
- Os estados do mapa (carregando, vazio, erro, layout) são trocados
  **somente** por `mostrarEstadoMapa(estado)`, que garante que só um fique
  visível (**8fde8b8**). Nunca manipule `hidden` desses quatro elementos
  diretamente.
- O card de detalhes escreve em `#detalhes-corpo`, **nunca** em
  `#detalhes`. O `#detalhes` contém o botão de fechar, que é a única saída
  do painel no celular, e ele seria apagado junto.

## Cytoscape

- O container precisa ter tamanho real quando o Cytoscape é criado, senão
  o grafo nasce em 0×0 (**dc8d7f8**). Ao exibir a aba do mapa, `mudarView`
  chama `cy.resize()`. Qualquer outro caminho que mostre o mapa precisa
  fazer o mesmo.
- O grafo nasce do livro (`LIVROS_RAIZ = ["genesis"]`), não de uma pessoa
  (**9bd97e0**).
- Filtros escondem arestas com a classe `escondido` (`aplicarFiltros`),
  sem removê-las do grafo.
- `centralizarEm` **não** refaz o layout quando o nó já está no centro, e
  para o layout anterior antes de rodar outro. Sem isso, cliques repetidos
  no mesmo nó faziam dois layouts animarem juntos e o zoom ia e voltava.
- A profundidade (classes `prof-0`…`prof-3` e `data(tamanhoVisual)`) é
  recalculada por `aplicarProfundidade` a cada foco e a cada filtro. Estilos
  de aresta por profundidade ficam **depois** dos de força no stylesheet,
  senão a opacidade da força os sobrescreve.
- Tipos de nó ocultos pelo olho da legenda usam a classe `tipo-oculto`,
  separada da `escondido` dos filtros de aresta. O estado verdadeiro está
  em `tiposOcultos`. Não decida por `ele.visible()` logo depois de trocar
  uma classe, porque o estilo ainda não foi recalculado. Layout e
  profundidade consideram só `:visible`.
- Todo campo usado em `data(...)` no stylesheet precisa existir desde a
  criação do elemento, senão o Cytoscape enche o console de avisos.
- **Performance:** `noPorId` e `arestaPorId` fazem busca linear
  (`Array.find`), e `indiceDoNo` a chama dentro de um laço sobre todas as
  arestas. Hoje não pesa, mas não adicione novos laços com busca linear
  dentro. Se precisar, crie um `Map` por id, construído uma vez no
  carregamento. O `/medir` diz quando isso passa a importar.

## Cores, ícones e tema

- Cores são variáveis CSS em `:root` (`estilo.css`), lidas no JS por
  `lerCores()`. Nunca escreva uma cor fixa no JS. Adicione a variável no
  CSS e um fallback em `lerCores()`.
- Cada tipo de nó tem uma cor (`--cor-pessoa`, `--cor-lugar`, ...) usada
  no grafo, na legenda e no card. Mudar uma exige mudar as três de forma
  coerente, e é por isso que ela é variável.
- Ícones: **Lucide** (licença MIT), grade 24×24, só o miolo do SVG, em
  `ICONES` (tipos de nó) e `ICONES_UI` (blocos do card) (**c2fe244**). Não
  desenhe ícones à mão nem misture bibliotecas.

## Celular

- Breakpoint único: **860px**. Ele está em `ehMovel()` no JS e nos
  `@media (max-width: 860px)` do CSS. Mudar um exige mudar os outros.
- No celular, os painéis flutuantes abrem sobre o grafo, e todo painel
  precisa de um botão de fechar visível e alcançável.
- Teste em 390×844. Nada pode transbordar horizontalmente.

## Acessibilidade e movimento

- Abas: `role="tab"`, `aria-selected` atualizado em `mudarView`,
  `aria-controls` apontando para o painel.
- Todo botão só com ícone tem `aria-label` (e `title` para o tooltip).
- Animações só quando `animacoesOk()` é verdadeiro, respeitando
  `prefers-reduced-motion` no JS e no CSS.
- O foco do teclado precisa ser visível.

## Conteúdo: a interface não inventa

Princípio escrito no comentário de `indiceDoNo`: tudo o que o card e o
dossiê mostram é **derivado do grafo**. A interface nunca cria texto
editorial, resumo ou afirmação próprios, porque isso seria conteúdo sem
fonte num projeto cujo princípio é que nada entra sem fonte.

- Rótulos de valores (`ROTULO_FORCA`, `ROTULO_APOIO`) só para valores que
  o schema define.
- Arestas estruturais (`cita`, `envolve`) não têm força nem fonte e nunca
  recebem selo de evidência.
- Uma fonte só vira link se tiver `url` nos dados, passando por
  `urlSegura` (só https). Nunca deduza um link a partir da descrição.
- Texto entre aspas passa por `comCitacoes`. A citação vira link só quando
  a origem é inequívoca pelos dados (o texto pertence a uma ligação com
  fontes). Em texto de Registro, ela fica só destacada. Nome de campo entre
  aspas (`"forca: aceito_maioria"`) não é citação.
- Força, fontes, `o_que_derrubaria` e "nenhum paralelo externo conhecido"
  nunca podem ficar escondidos atrás de uma interação obscura, nem
  truncados sem forma de expandir.

## Cache

- `index.html` referencia `estilo.css?v=N` e `app.js?v=N`, sempre com o
  **mesmo N**. Quem incrementa é o `/publicar`, via
  `scripts/versao-assets.js`. Não incremente à mão durante a revisão.
