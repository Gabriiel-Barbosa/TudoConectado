// Página estática: troca de abas + grafo navegável (Cytoscape.js) lendo
// grafo.json/timeline.json gerados por scripts/compilar.js. Nenhum dado é
// editado aqui — isso é só leitura/visualização (ver seção 7 da arquitetura).

const botoesNav = document.querySelectorAll("nav button[data-view]");
const paineis = document.querySelectorAll("[data-view-panel]");
const tooltip = document.querySelector("#tooltip");

let cy = null;
let grafo = { nos: [], arestas: [] };
// Cada passo guarda o id do no E o id da aresta percorrida para chegar ate
// ele — sem a aresta nao da para dizer "voce chegou aqui via 'confirma'".
let historico = [];
const cores = lerCores();

// Registros tipo=texto tratados como "livro" — o ponto de partida da
// árvore, por cima até de Passagem (a base é a Bíblia e seus livros;
// capítulos e conexões nascem dali). Só Gênesis por enquanto; quando outro
// livro entrar, soma aqui (ou isso vira um campo próprio no schema).
const LIVROS_RAIZ = ["genesis"];

// Ícones da Lucide (MIT, github.com/lucide-icons/lucide), grade 24x24 —
// só o miolo do SVG, pra servir tanto inline no HTML (cor via CSS) quanto
// como imagem dentro dos nós do Cytoscape (cor fixa via uriIcone).
const ICONES = {
  livro: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  passagem:
    '<path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"/>',
  afirmacao:
    '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>',
  pessoa: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  lugar:
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  acontecimento: '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>',
  texto:
    '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  objeto:
    '<path d="M10 2v5.632c0 .424-.272.795-.653.982A6 6 0 0 0 6 14c.006 4 3 7 5 8"/><path d="M10 5H8a2 2 0 0 0 0 4h.68"/><path d="M14 2v5.632c0 .424.272.795.652.982A6 6 0 0 1 18 14c0 4-3 7-5 8"/><path d="M14 5h2a2 2 0 0 1 0 4h-.68"/><path d="M18 22H6"/><path d="M9 2h6"/>',
};

const ROTULO_CATEGORIA = {
  livro: "Livro",
  passagem: "Passagem",
  afirmacao: "Afirmação",
  pessoa: "Pessoa",
  lugar: "Lugar",
  acontecimento: "Acontecimento",
  texto: "Texto",
  objeto: "Objeto",
};

function categoriaDoNo(no) {
  if (LIVROS_RAIZ.includes(no.id)) return "livro";
  if (no.tipo === "passagem" || no.tipo === "afirmacao") return no.tipo;
  return no.subtipo;
}

function corDaCategoria(categoria) {
  return categoria === "livro" ? cores.texto : cores[categoria] || cores.muted;
}

function iconeInline(categoria, cor) {
  const estiloCor = cor ? ` style="color:${cor}"` : "";
  return `<svg viewBox="0 0 24 24" class="icone" aria-hidden="true"${estiloCor}>${ICONES[categoria] || ""}</svg>`;
}

// Mistura duas cores #rrggbb (t = 0 devolve a, t = 1 devolve b). Só serve
// para derivar o sombreado da esfera a partir das variáveis do CSS.
function misturar(a, b, t) {
  const rgb = (hex) => {
    const h = hex.replace("#", "");
    const cheio = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(cheio.slice(i, i + 2), 16) || 0);
  };
  const [ra, ga, ba] = rgb(a);
  const [rb, gb, bb] = rgb(b);
  const canal = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${canal(ra, rb)}${canal(ga, gb)}${canal(ba, bb)}`;
}

// Cada nó é desenhado como uma esfera: o gradiente radial com a luz vindo
// do alto à esquerda dá o volume (o "3D" discreto, à la Obsidian), e o ícone
// vai por cima. Dentro do canvas não existe currentColor — as cores vão
// fixas no próprio SVG. Orbes (livro, passagem) são esferas cheias na cor da
// categoria; o resto é vidro escuro com um leve reflexo da cor.
function uriNo(categoria, { orbe }) {
  const cor = corDaCategoria(categoria);
  const [claro, base, escuro] = orbe
    ? [misturar(cor, "#ffffff", 0.35), cor, misturar(cor, "#000000", 0.45)]
    : [misturar(cores.bg, cor, 0.3), misturar(cores.bg, "#ffffff", 0.07), misturar(cores.bg, "#000000", 0.5)];
  const corIcone = orbe ? cores.bg : cor;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><radialGradient id="e" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="${claro}"/><stop offset="0.55" stop-color="${base}"/><stop offset="1" stop-color="${escuro}"/></radialGradient></defs><circle cx="50" cy="50" r="50" fill="url(#e)"/><g transform="translate(29 29) scale(1.75)" fill="none" stroke="${corIcone}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES[categoria] || ""}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// "1 nó", "2 nós" — em vez de "nó(s)", que lê mal em voz alta e no olho.
function plural(n, singular, pluralForma) {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

const ehMovel = () => window.matchMedia("(max-width: 860px)").matches;
const animacoesOk = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

botoesNav.forEach((botao) => {
  botao.addEventListener("click", () => {
    // Passagens é a Bíblia: abre direto o capítulo em leitura.
    if (botao.dataset.view === "passagens") {
      abrirBiblia();
      return;
    }
    if (lerCapituloDoHash()) history.pushState(null, "", location.pathname);
    mudarView(botao.dataset.view);
  });
});

function mudarView(nome) {
  // A leitura de um capítulo não tem aba própria: ela é a aba Passagens
  // aprofundada, e é essa aba que fica marcada.
  const aba = nome === "leitura" ? "passagens" : nome;
  if (nome !== "leitura") {
    fecharNota({ devolverFoco: false });
    fecharPersonagem();
  }
  botoesNav.forEach((b) => {
    const ativo = b.dataset.view === aba;
    b.classList.toggle("ativo", ativo);
    b.setAttribute("aria-selected", String(ativo));
  });
  paineis.forEach((p) => {
    p.hidden = p.id !== `view-${nome}`;
  });
  if (nome === "mapa" && cy) cy.resize();
}

function lerCores() {
  const estilo = getComputedStyle(document.documentElement);
  const pega = (nome, fallback) => estilo.getPropertyValue(nome).trim() || fallback;
  return {
    fg: pega("--fg", "#edeef3"),
    bg: pega("--bg", "#0a0c10"),
    cartaoNo: pega("--bg-cartao-no", "rgba(22,25,33,0.95)"),
    muted: pega("--muted", "#8b8fa0"),
    ouro: pega("--ouro", "#d9a24b"),
    violeta: pega("--violeta", "#8b6bf0"),
    accent: pega("--accent", "#34d3c9"),
    pessoa: pega("--cor-pessoa", "#e08a4b"),
    lugar: pega("--cor-lugar", "#4bc98a"),
    acontecimento: pega("--cor-acontecimento", "#d1609e"),
    texto: pega("--cor-texto", "#d9a24b"),
    objeto: pega("--cor-objeto", "#7c8cf0"),
    afirmacao: pega("--cor-afirmacao", "#34d3c9"),
    passagem: pega("--cor-passagem", "#8b6bf0"),
  };
}

function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

function truncar(texto, max) {
  if (!texto) return "";
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

async function carregarJSON(caminho) {
  const controle = new AbortController();
  const tempoLimite = setTimeout(() => controle.abort(), 10000);
  try {
    const resposta = await fetch(caminho, { signal: controle.signal });
    if (!resposta.ok) return null;
    return await resposta.json();
  } catch {
    return null;
  } finally {
    clearTimeout(tempoLimite);
  }
}

// --- Grafo -----------------------------------------------------------------

function rotuloDoNo(no) {
  if (no.tipo === "registro") return no.nome;
  if (no.tipo === "passagem") return no.referencia;
  if (no.tipo === "afirmacao") return truncar(no.texto, 40);
  return no.id;
}

function elementosCytoscape(g) {
  const nos = g.nos.map((no) => {
    const categoria = categoriaDoNo(no);
    const orbe = categoria === "livro" || categoria === "passagem";
    return {
      // tamanho/tamanhoVisual nascem com um valor provisório (o real vem de
      // aplicarTamanhoPorGrau): um mapeamento data() sem o campo definido
      // enche o console de avisos do Cytoscape.
      data: {
        ...no,
        rotulo: rotuloDoNo(no),
        icone: uriNo(categoria, { orbe }),
        corCategoria: corDaCategoria(categoria),
        tamanho: 32,
        tamanhoVisual: 32,
      },
    };
  });
  const arestas = g.arestas.map((aresta) => ({
    data: { ...aresta, source: aresta.origem, target: aresta.destino },
  }));
  return [...nos, ...arestas];
}

function estilosCytoscape() {
  return [
    {
      // Nós, por padrão: esfera de vidro escuro (ver uriNo) com um aro fino
      // na cor da categoria — a cor carrega o significado, o volume vem do
      // sombreado. A largura sai de data(tamanhoVisual), que já embute a
      // profundidade (ver aplicarProfundidade).
      selector: "node",
      style: {
        label: "data(rotulo)",
        "font-size": 10,
        "font-family": "Inter, system-ui, sans-serif",
        color: cores.fg,
        "text-valign": "bottom",
        "text-margin-y": 6,
        "text-wrap": "ellipsis",
        "text-max-width": "90px",
        // Contorno na cor do fundo: o rótulo continua legível quando passa
        // por cima de uma aresta ou de outro nó.
        "text-outline-color": cores.bg,
        "text-outline-width": 2,
        "text-outline-opacity": 0.85,
        shape: "ellipse",
        width: "data(tamanhoVisual)",
        height: "data(tamanhoVisual)",
        "background-color": cores.bg,
        "background-image": "data(icone)",
        "background-fit": "none",
        "background-width": "100%",
        "background-height": "100%",
        "background-clip": "node",
        "border-width": 1.5,
        "border-color": cores.muted,
        "border-opacity": 0.9,
        "transition-property":
          "opacity, background-image-opacity, border-opacity, border-width, width, height, underlay-opacity",
        "transition-duration": animacoesOk() ? "300ms" : "0ms",
      },
    },
    { selector: "node[subtipo='pessoa']", style: { "border-color": cores.pessoa } },
    { selector: "node[subtipo='lugar']", style: { "border-color": cores.lugar } },
    { selector: "node[subtipo='acontecimento']", style: { "border-color": cores.acontecimento } },
    { selector: "node[subtipo='texto']", style: { "border-color": cores.texto } },
    { selector: "node[subtipo='objeto']", style: { "border-color": cores.objeto } },
    { selector: "node[tipo='afirmacao']", style: { "border-color": cores.afirmacao } },

    // A Passagem é um ponto de partida da árvore — vira um orbe cheio e
    // "aceso", com um halo (underlay), pra puxar o olho pro centro.
    {
      selector: "node[tipo='passagem']",
      style: {
        "border-width": 0,
        "underlay-color": cores.passagem,
        "underlay-padding": 7,
        "underlay-opacity": 0.2,
        "underlay-shape": "ellipse",
        color: cores.fg,
        "font-weight": 600,
      },
    },

    // O Livro (ver LIVROS_RAIZ) é a raiz de tudo — a base é a Bíblia e seus
    // livros, capítulos e conexões nascem dali. Mesmo tratamento de orbe da
    // Passagem, mas na cor de "texto" (é um registro tipo=texto), com halo
    // maior, porque fica acima até da Passagem na hierarquia.
    {
      selector: `node[id = "${LIVROS_RAIZ.join('"], node[id = "')}"]`,
      style: {
        "border-width": 0,
        "underlay-color": cores.texto,
        "underlay-padding": 9,
        "underlay-opacity": 0.22,
        "underlay-shape": "ellipse",
        color: cores.fg,
        "font-weight": 700,
        "font-size": 12,
      },
    },

    // O nó em foco ganha um halo na própria cor — é o "mais perto" da cena.
    {
      selector: "node.foco",
      style: {
        "border-width": 2.5,
        "border-opacity": 1,
        "underlay-color": "data(corCategoria)",
        "underlay-padding": 10,
        "underlay-opacity": 0.28,
        "underlay-shape": "ellipse",
      },
    },
    { selector: "node.escondido, node.tipo-oculto", style: { display: "none" } },

    // Profundidade a partir do nó em foco (ver aplicarProfundidade): quanto
    // mais longe no grafo, menor (via tamanhoVisual), mais apagado e mais
    // "atrás" (z-index). É o que dá a sensação de cena em camadas sem
    // esconder nada — os nós distantes continuam legíveis e clicáveis.
    // Só a esfera e o aro apagam; o rótulo nunca. "opacity" no nó levava o
    // rótulo junto (0,38 × 0,35 ≈ 13% no nível 3) e o nome sumia no fundo.
    // Os cinzas do rótulo ficam acima de 7:1 sobre o fundo (WCAG AA pede 4.5:1).
    { selector: "node.prof-0", style: { "z-index": 30 } },
    { selector: "node.prof-1", style: { "z-index": 20 } },
    {
      selector: "node.prof-2",
      style: { "z-index": 10, "background-image-opacity": 0.6, "border-opacity": 0.5, color: ROTULO_PROFUNDO[0] },
    },
    {
      selector: "node.prof-3",
      style: { "z-index": 0, "background-image-opacity": 0.4, "border-opacity": 0.35, color: ROTULO_PROFUNDO[1] },
    },

    // Passar o mouse num nó acende as ligações dele (como no Obsidian),
    // sem mexer no resto da cena.
    { selector: "node.realce", style: { "background-image-opacity": 1, "border-opacity": 1, color: cores.fg } },

    {
      // Ligações com evidência real: fio dourado, como um fio "aceso" —
      // as arestas 'cita' (estruturais, sem força/fonte) ficam discretas.
      selector: "edge",
      style: {
        "curve-style": "bezier",
        "target-arrow-shape": "triangle",
        "target-arrow-color": cores.ouro,
        "line-color": cores.ouro,
        width: 1.5,
        opacity: 0.8,
        "arrow-scale": 0.7,
        "transition-property": "opacity",
        "transition-duration": "150ms",
      },
    },
    {
      selector: "edge[tipo='cita'], edge[tipo='envolve'], edge[tipo='parte_de']",
      style: {
        "line-style": "dashed",
        "line-color": cores.muted,
        "target-arrow-shape": "none",
        width: 1,
        opacity: 0.35,
      },
    },
    // Paralelo afirma semelhança, não dependência: sem seta (ninguém "vem"
    // de ninguém) e numa cor própria, para não parecer uma confirmação.
    {
      selector: "edge[tipo='paralelo']",
      style: { "line-color": cores.violeta, "target-arrow-shape": "none" },
    },
    { selector: "edge[forca='bem_estabelecido']", style: { width: 3, opacity: 1 } },
    { selector: "edge[forca='aceito_maioria']", style: { width: 2.5, opacity: 0.85 } },
    { selector: "edge[forca='disputado']", style: { "line-style": "dashed", width: 2 } },
    { selector: "edge[forca='poucos']", style: { "line-style": "dashed", width: 1.5, opacity: 0.65 } },
    { selector: "edge[forca='especulacao']", style: { "line-style": "dotted", width: 1.5, opacity: 0.55 } },
    { selector: "edge.escondido", style: { display: "none" } },

    // Depois das regras de força, senão a opacidade da força sobrescreveria
    // a da profundidade.
    { selector: "edge.prof-2", style: { opacity: 0.4 } },
    { selector: "edge.prof-3", style: { opacity: 0.2 } },
    { selector: "edge.realce", style: { opacity: 1, "z-index": 99 } },
  ];
}

// Amostras de linha usadas tanto na legenda de filtros quanto nos detalhes,
// para o traço da lista bater exatamente com o traço desenhado no grafo.
const AMOSTRA_FORCA = {
  bem_estabelecido: { "border-top-width": "3px", "border-top-style": "solid" },
  aceito_maioria: { "border-top-width": "2.5px", "border-top-style": "solid" },
  disputado: { "border-top-width": "2px", "border-top-style": "dashed" },
  poucos: { "border-top-width": "1.5px", "border-top-style": "dashed" },
  especulacao: { "border-top-width": "1.5px", "border-top-style": "dotted" },
};

function estiloAmostra(forca) {
  const base = AMOSTRA_FORCA[forca] || { "border-top-width": "1.5px", "border-top-style": "solid" };
  return Object.entries(base)
    .map(([chave, valor]) => `${chave}:${valor}`)
    .join(";");
}

function aplicarTamanhoPorGrau() {
  const graus = cy.nodes().map((n) => n.degree());
  const maxGrau = Math.max(1, ...graus);
  cy.nodes().forEach((n) => {
    const proporcao = n.degree() / maxGrau;
    // Mínimo de 32px pra o ícone dentro do nó continuar legível.
    const tamanho = 32 + proporcao * 22;
    n.data({ tamanho, tamanhoVisual: tamanho });
  });
}

// Distância (em saltos, ignorando a direção das arestas e as escondidas por
// filtro) de cada nó até a raiz em foco.
function distanciasAte(id) {
  const distancias = new Map([[id, 0]]);
  const fila = [cy.$id(id)];
  while (fila.length > 0) {
    const atual = fila.shift();
    const d = distancias.get(atual.id());
    atual
      .connectedEdges(":visible")
      .connectedNodes(":visible")
      .forEach((vizinho) => {
        if (distancias.has(vizinho.id())) return;
        distancias.set(vizinho.id(), d + 1);
        fila.push(vizinho);
      });
  }
  return distancias;
}

// Profundidade: o nó em foco e os vizinhos ficam "na frente"; o resto vai
// recuando (menor, mais apagado, atrás). Substitui o antigo apagamento
// quase total (opacidade 0.1) dos não vizinhos, que deixava rótulos ilegíveis.
const ESCALA_POR_PROFUNDIDADE = [1.12, 1, 0.84, 0.7];
// Cor do rótulo nos níveis 2 e 3: 10,3:1 e 8,2:1 sobre --bg (#0a0c10).
const ROTULO_PROFUNDO = ["#b9bcc8", "#a3a7b5"];

function aplicarProfundidade(id) {
  const distancias = distanciasAte(id);
  const nivel = (noId) => Math.min(distancias.get(noId) ?? 3, 3);
  cy.batch(() => {
    cy.elements().removeClass("prof-0 prof-1 prof-2 prof-3");
    cy.nodes().forEach((n) => {
      const p = nivel(n.id());
      n.addClass(`prof-${p}`);
      n.data("tamanhoVisual", n.data("tamanho") * ESCALA_POR_PROFUNDIDADE[p]);
    });
    cy.edges().forEach((e) => {
      e.addClass(`prof-${Math.max(nivel(e.source().id()), nivel(e.target().id()))}`);
    });
  });
}

// Único lugar que decide qual dos quatro estados do mapa aparece. Cada
// chamada esconde os outros três — não tem como dois ficarem visíveis ao
// mesmo tempo, não importa em que ordem ou de onde isso for chamado.
function mostrarEstadoMapa(estado) {
  const paineis = {
    carregando: document.querySelector("#mapa-carregando"),
    vazio: document.querySelector("#mapa-vazio"),
    erro: document.querySelector("#mapa-erro"),
    layout: document.querySelector("#mapa-layout"),
  };
  for (const [nome, elemento] of Object.entries(paineis)) {
    if (elemento) elemento.hidden = nome !== estado;
  }
}

function iniciarGrafo(grafoData) {
  grafo = grafoData;

  const semDados = !grafo.nos || grafo.nos.length === 0;
  if (semDados) {
    mostrarEstadoMapa("vazio");
    return;
  }

  // O container precisa estar visível ANTES do Cytoscape nascer: ele mede o
  // tamanho do container na criação, e um container hidden mede 0x0 — zoom,
  // centralização e até a posição dos cliques saem errados.
  mostrarEstadoMapa("layout");

  // Se o Cytoscape falhar por qualquer motivo (CDN bloqueado, canvas
  // indisponível, dado inesperado), isso não pode deixar a tela travada
  // em "carregando" — mostra um estado de erro em vez de travar em branco.
  try {
    if (cy) {
      // "Tentar novamente" pode chamar isto de novo — não deixa a
      // instância anterior do Cytoscape presa no mesmo container.
      cy.destroy();
      cy = null;
    }
    cy = cytoscape({
      container: document.querySelector("#grafo-canvas"),
      elements: elementosCytoscape(grafo),
      style: estilosCytoscape(),
      // Sem layout na criação: um layout animado aqui continuava rodando
      // em paralelo com o de centralizarEm() e sobrescrevia as posições.
      layout: { name: "preset" },
      minZoom: 0.3,
      maxZoom: 2.5,
      wheelSensitivity: 0.3,
    });
    cy.resize();

    aplicarTamanhoPorGrau();

    cy.on("tap", "node", (evento) => {
      const alvo = evento.target.id();
      centralizarEm(alvo, { viaAresta: arestaEntre(idDoNoAtual(), alvo) });
    });
    cy.on("tap", "edge", (evento) => {
      mostrarDetalhesAresta(evento.target.data());
      abrirDetalhesSeMovel();
    });
    cy.on("tap", (evento) => {
      if (evento.target === cy) {
        limparDetalhes();
        limparFoco();
      }
    });

    cy.on("mouseover", "node", (evento) => {
      mostrarTooltip(evento.target.data());
      evento.target.closedNeighborhood().addClass("realce");
    });
    cy.on("mouseout", "node", () => {
      tooltip.hidden = true;
      cy.elements(".realce").removeClass("realce");
    });
    cy.on("mousemove", (evento) => posicionarTooltip(evento.originalEvent));

    cy.on("viewport", agendarParallax);
    agendarParallax();
  } catch (erro) {
    console.error("Falha ao iniciar o grafo:", erro);
    mostrarEstadoMapa("erro");
    return;
  }

  // O grafo em si já está de pé nesse ponto (Cytoscape criado com sucesso).
  // Um erro aqui embaixo é só nos controles ao redor — não faz sentido
  // esconder um grafo que já funciona por causa de um filtro que quebrou.
  try {
    document.querySelector("#stat-grafo").textContent = `${plural(grafo.nos.length, "nó", "nós")} · ${plural(
      grafo.arestas.length,
      "ligação",
      "ligações"
    )}`;

    montarLegenda();
    montarSeletorRaiz();
    montarFiltros();
    configurarBusca();
    configurarFerramentas();
    configurarPaineisMoveis();
    configurarDossie();

    // A árvore nasce do livro — só cai pra uma passagem se nenhum livro
    // estiver carregado (ver LIVROS_RAIZ).
    const raizInicial =
      grafo.nos.find((n) => LIVROS_RAIZ.includes(n.id)) || grafo.nos.find((n) => n.tipo === "passagem");
    if (raizInicial) {
      centralizarEm(raizInicial.id, { abrirPainel: false });
    } else {
      cy.layout({ name: "breadthfirst", circle: true, spacingFactor: 1.4, padding: 60 }).run();
    }
  } catch (erro) {
    console.error("Falha ao montar os controles do grafo:", erro);
  }
}

// O fundo tem duas camadas de pontos que acompanham o pan/zoom mais devagar
// que o grafo (ver #grafo-canvas no CSS) — a diferença de velocidade é o
// que faz o grafo parecer flutuar à frente do fundo. Uma atualização por
// frame, no máximo: o evento "viewport" dispara dezenas de vezes num arrasto.
let parallaxAgendado = false;

function agendarParallax() {
  if (parallaxAgendado || !cy) return;
  parallaxAgendado = true;
  requestAnimationFrame(() => {
    parallaxAgendado = false;
    if (!cy) return;
    const canvas = document.querySelector("#grafo-canvas");
    const { x, y } = cy.pan();
    canvas.style.setProperty("--pan-x", `${x}px`);
    canvas.style.setProperty("--pan-y", `${y}px`);
    canvas.style.setProperty("--zoom-fundo", Math.sqrt(cy.zoom()).toFixed(3));
  });
}

function mostrarTooltip(no) {
  const categoria = ROTULO_CATEGORIA[categoriaDoNo(no)] || no.tipo;
  tooltip.innerHTML = `<strong>${escapar(rotuloDoNo(no))}</strong><span>${escapar(categoria)}</span>`;
  tooltip.hidden = false;
}

function posicionarTooltip(eventoOriginal) {
  if (!eventoOriginal || tooltip.hidden) return;
  tooltip.style.left = `${eventoOriginal.clientX + 14}px`;
  tooltip.style.top = `${eventoOriginal.clientY + 14}px`;
}


// Roda o layout só sobre o que está visível: nós de tipo oculto e arestas
// filtradas não ocupam lugar na árvore nem entram no enquadramento.
// Geometria e câmera.
// - Layout radial próprio: o nó em foco no centro e cada distância a ele num
//   anel de raio RAIO_POR_NIVEL × distância. O raio não depende da tela —
//   antes saía da largura do container, e no celular os anéis colavam e os
//   rótulos se sobrepunham. Nós de um anel ficam perto do "pai" no anel de
//   dentro e são afastados até caber um rótulo entre eles.
// - A câmera enquadra a área livre da tela (sem painéis, barra e alça por
//   cima). Mostra o grafo inteiro só se ele couber com rótulo legível
//   (ZOOM_LEGIVEL = rótulo de 10px); senão, o foco e os vizinhos diretos, e
//   o resto fica a um arrasto. Antes o fit caía ao zoom mínimo (rótulos de 3px).
const RAIO_POR_NIVEL = 170;
const RAIO_POR_NIVEL_MOVEL = 120; // tela estreita: anéis mais próximos
const ALTURA_NO_COM_ROTULO = 80;
const LARGURA_ROTULO = 120; // espaço de arco por nó num anel (rótulo + folga)
const ZOOM_LEGIVEL = 1;
const ZOOM_MAXIMO_ENQUADRAR = 1.6;
const MARGEM_ENQUADRAR = 28;

function posicoesRadiais(raiz, nos) {
  const posicoes = new Map();
  if (!raiz) return posicoes;
  const distancias = distanciasAte(raiz.id());
  const angulo = new Map([[raiz.id(), 0]]);
  posicoes.set(raiz.id(), { x: 0, y: 0 });

  const porNivel = new Map();
  nos.forEach((n) => {
    if (n.id() === raiz.id()) return;
    const d = distancias.get(n.id()) ?? 1 + Math.max(0, ...distancias.values());
    if (!porNivel.has(d)) porNivel.set(d, []);
    porNivel.get(d).push(n);
  });

  for (const d of [...porNivel.keys()].sort((a, b) => a - b)) {
    const anel = porNivel.get(d);
    const raio = d * (ehMovel() ? RAIO_POR_NIVEL_MOVEL : RAIO_POR_NIVEL);
    const passoMinimo = Math.min(LARGURA_ROTULO / raio, (2 * Math.PI) / anel.length);
    let angulos;
    if (d === 1) {
      // Primeiro anel: distribuído por igual, girado para o ângulo em que o
      // foco e os vizinhos melhor cabem na área livre. Numa tela em pé, dois
      // vizinhos vão para cima e para baixo em vez de saírem pelas bordas.
      angulos = girarParaCaber(anel.length, raio);
    } else {
      // Anéis de fora: cada nó mira o ângulo médio dos vizinhos do anel de
      // dentro; depois uma varredura afasta quem ficou perto demais.
      const alvo = anel.map((n) => {
        const pais = n.neighborhood("node").filter((v) => angulo.has(v.id()) && distancias.get(v.id()) === d - 1);
        if (pais.empty()) return 0;
        const sx = pais.reduce((s, p) => s + Math.cos(angulo.get(p.id())), 0);
        const sy = pais.reduce((s, p) => s + Math.sin(angulo.get(p.id())), 0);
        return Math.atan2(sy, sx);
      });
      const ordem = anel.map((n, i) => ({ n, a: alvo[i] })).sort((p, q) => p.a - q.a);
      for (let i = 1; i < ordem.length; i++) {
        ordem[i].a = Math.max(ordem[i].a, ordem[i - 1].a + passoMinimo);
      }
      // Centraliza o bloco no ângulo-alvo médio (a varredura só empurra para um lado).
      const deslocamento =
        ordem.reduce((s, o, i) => s + (o.a - alvo[anel.indexOf(o.n)]), 0) / Math.max(1, ordem.length);
      ordem.forEach((o) => (o.a -= deslocamento));
      // Dando a volta no círculo, o último pode encostar no primeiro:
      // nesse caso o anel está cheio e vai distribuído por igual.
      const fechaVolta = ordem.length > 1 && ordem[0].a + 2 * Math.PI - ordem[ordem.length - 1].a < passoMinimo;
      if (fechaVolta) ordem.forEach((o, i) => (o.a = ordem[0].a + (2 * Math.PI * i) / ordem.length));
      anel.splice(0, anel.length, ...ordem.map((o) => o.n));
      angulos = ordem.map((o) => o.a);
    }
    anel.forEach((n, i) => {
      angulo.set(n.id(), angulos[i]);
      posicoes.set(n.id(), { x: raio * Math.cos(angulos[i]), y: raio * Math.sin(angulos[i]) });
    });
  }
  return posicoes;
}

function girarParaCaber(quantos, raio) {
  const livre = areaLivre();
  const larg = Math.max(1, livre.x2 - livre.x1);
  const alt = Math.max(1, livre.y2 - livre.y1);
  const passo = (2 * Math.PI) / quantos;
  let melhor = { custo: Infinity, inicio: 0 };
  for (let k = 0; k < 24; k++) {
    const inicio = -Math.PI / 2 + (passo * k) / 24;
    const xs = [0], ys = [0];
    for (let i = 0; i < quantos; i++) {
      xs.push(raio * Math.cos(inicio + passo * i));
      ys.push(raio * Math.sin(inicio + passo * i));
    }
    const custo = Math.max(
      (Math.max(...xs) - Math.min(...xs) + LARGURA_ROTULO) / larg,
      (Math.max(...ys) - Math.min(...ys) + ALTURA_NO_COM_ROTULO) / alt
    );
    if (custo < melhor.custo - 1e-9) melhor = { custo, inicio };
  }
  return Array.from({ length: quantos }, (_, i) => melhor.inicio + passo * i);
}

// Retângulo da tela (em px do container) que nenhum painel cobre.
function areaLivre() {
  const caixa = cy.container().getBoundingClientRect();
  // Só a parte do container que está na janela conta: com o celular
  // deitado, o cabeçalho empurra o mapa e parte dele fica abaixo da dobra.
  const livre = {
    x1: 0,
    y1: Math.max(0, -caixa.top),
    x2: caixa.width,
    y2: Math.min(caixa.height, window.innerHeight - caixa.top),
  };
  const visivel = (el) => el && !el.hidden && !el.classList.contains("oculto") && el.offsetParent !== null;
  const rel = (el) => {
    const r = el.getBoundingClientRect();
    return { x1: r.left - caixa.left, x2: r.right - caixa.left, y1: r.top - caixa.top, y2: r.bottom - caixa.top };
  };
  if (!ehMovel()) {
    for (const seletor of ["#mapa-controles", "#detalhes"]) {
      const el = document.querySelector(seletor);
      if (!visivel(el)) continue;
      const r = rel(el);
      if (r.x1 < caixa.width / 2) livre.x1 = Math.max(livre.x1, r.x2);
      else livre.x2 = Math.min(livre.x2, r.x1);
    }
  }
  for (const seletor of [".ferramentas", "#trilha", "#alca-detalhes"]) {
    const el = document.querySelector(seletor);
    // A alça só aparece depois da centralização (ver atualizarAlca), mas o
    // enquadramento é calculado antes: reserva o lugar dela se vai aparecer.
    const alcaVaiAparecer =
      seletor === "#alca-detalhes" &&
      ehMovel() &&
      alcaCabe() &&
      document.querySelector("#detalhes").classList.contains("oculto") &&
      document.querySelector("#mapa-controles").classList.contains("oculto");
    if (!visivel(el) && !alcaVaiAparecer) continue;
    const escondida = el.hidden;
    el.hidden = false;
    const r = rel(el);
    el.hidden = escondida;
    // A alça é fixa no rodapé da janela: sempre limita por baixo, mesmo
    // quando a janela corta o mapa e ela cai no meio do container.
    const emCima = seletor !== "#alca-detalhes" && r.y1 < (livre.y1 + livre.y2) / 2;
    if (emCima) livre.y1 = Math.max(livre.y1, r.y2);
    else livre.y2 = Math.min(livre.y2, r.y1);
  }
  // Painéis largos demais para a tela: ignora e usa o container inteiro.
  if (livre.x2 - livre.x1 < 200) Object.assign(livre, { x1: 0, x2: caixa.width });
  if (livre.y2 - livre.y1 < 120) Object.assign(livre, { y1: Math.max(0, -caixa.top), y2: Math.min(caixa.height, window.innerHeight - caixa.top) });
  return livre;
}

// Câmera que enquadra `caixa` (coordenadas do modelo) na área livre.
function cameraPara(caixa, livre, zoomFixo = null) {
  const larg = livre.x2 - livre.x1 - 2 * MARGEM_ENQUADRAR;
  const alt = livre.y2 - livre.y1 - 2 * MARGEM_ENQUADRAR;
  const zoom = zoomFixo ?? Math.min(larg / Math.max(caixa.w, 1), alt / Math.max(caixa.h, 1), ZOOM_MAXIMO_ENQUADRAR);
  const cx = (caixa.x1 + caixa.x2) / 2;
  const cy_ = (caixa.y1 + caixa.y2) / 2;
  return {
    zoom,
    pan: { x: (livre.x1 + livre.x2) / 2 - zoom * cx, y: (livre.y1 + livre.y2) / 2 - zoom * cy_ },
  };
}

// As caixas incluem os rótulos; como a largura do rótulo em modelo não muda
// com o zoom, medir no zoom 1 basta.
function enquadramento(raiz) {
  const livre = areaLivre();
  const caixaDe = (els) => els.boundingBox({ includeLabels: true });
  const tudo = cameraPara(caixaDe(cy.elements(":visible")), livre);
  if (tudo.zoom >= ZOOM_LEGIVEL || !raiz) return tudo;
  const vizinhos = cameraPara(caixaDe(raiz.closedNeighborhood(":visible")), livre);
  if (vizinhos.zoom >= ZOOM_LEGIVEL) return vizinhos;
  return cameraPara(caixaDe(raiz), livre, ZOOM_LEGIVEL);
}

function rodarLayout(raiz) {
  cy.stop(true);
  cy.nodes().stop(true);

  const nos = cy.nodes(":visible");
  const antes = new Map(nos.map((n) => [n.id(), { ...n.position() }]));
  let depois = posicoesRadiais(raiz, nos);
  if (!raiz) {
    // Sem foco (o nó em foco foi ocultado): círculo simples com o que sobrou.
    const raio = Math.max(ehMovel() ? RAIO_POR_NIVEL_MOVEL : RAIO_POR_NIVEL, (nos.length * LARGURA_ROTULO) / (2 * Math.PI));
    depois = new Map(
      nos.map((n, i) => [n.id(), { x: raio * Math.cos((2 * Math.PI * i) / nos.length), y: raio * Math.sin((2 * Math.PI * i) / nos.length) }])
    );
  }

  // Aplica as posições finais só para medir o enquadramento; depois nós e
  // câmera animam juntos até lá, num movimento só.
  nos.forEach((n) => n.position(depois.get(n.id())));
  const camera = enquadramento(raiz);

  if (!animacoesOk()) {
    cy.viewport(camera);
    return;
  }
  const duracao = 400;
  nos.forEach((n) => {
    n.position(antes.get(n.id()));
    n.animate({ position: depois.get(n.id()) }, { duration: duracao, easing: "ease-in-out-cubic" });
  });
  cy.animate(camera, { duration: duracao, easing: "ease-in-out-cubic" });
}

// `abrirPainel: false` para centralizações que não vêm de um gesto do
// leitor (a carga inicial, o re-layout ao ocultar um tipo): no celular, abrir
// o card nesses casos cobria o grafo antes de alguém tocar em nada.
function centralizarEm(
  id,
  { registrarHistorico = true, viaAresta = null, forcarLayout = false, abrirPainel = true } = {}
) {
  if (!cy || cy.$id(id).empty()) return;
  const alvo = cy.$id(id);

  // Ir para um nó de um tipo oculto (pela busca, pela legenda, por uma
  // conexão no card) mostra o tipo de novo — senão a câmera centralizaria
  // num nó invisível.
  const categoriaAlvo = categoriaDoNo(alvo.data());
  const revelou = tiposOcultos.delete(categoriaAlvo);
  if (revelou) aplicarTiposOcultos();

  // Clicar de novo no nó que já está no centro não refaz o layout. Antes,
  // cada clique rodava outro breadthfirst com fit animado — e, com cliques
  // seguidos, dois layouts animavam ao mesmo tempo e o zoom ia e voltava.
  const jaCentralizado = id === idDoNoAtual() && alvo.hasClass("foco");
  if (!jaCentralizado || forcarLayout || revelou) rodarLayout(alvo);

  const seletor = document.querySelector("#seletor-raiz");
  if (seletor && [...seletor.options].some((o) => o.value === id)) seletor.value = id;

  cy.elements().removeClass("foco");
  alvo.addClass("foco");
  aplicarProfundidade(id);

  if (registrarHistorico) {
    historico = historico.filter((h) => h.id !== id);
    historico.push({ id, aresta: viaAresta });
    if (historico.length > 8) historico.shift();
  }
  renderizarTrilha();

  const no = noPorId(id);
  if (no) {
    mostrarDetalhesNo(no);
    if (abrirPainel) abrirDetalhesSeMovel();
  }
  atualizarAlca();
}

// A alça aparece no celular quando o card está fechado e há um nó em foco.
// Em tela baixa (celular deitado) ela cobriria o meio do mapa; ali o botão
// de detalhes da barra de ferramentas basta.
const ALTURA_MINIMA_ALCA = 500;
const alcaCabe = () => window.innerHeight >= ALTURA_MINIMA_ALCA;

function atualizarAlca() {
  const alca = document.querySelector("#alca-detalhes");
  if (!alca) return;
  const emFoco = cy ? cy.nodes(".foco") : null;
  const no = emFoco && emFoco.nonempty() ? noPorId(emFoco.id()) : null;
  const cardFechado = document.querySelector("#detalhes").classList.contains("oculto");
  const controlesFechados = document.querySelector("#mapa-controles").classList.contains("oculto");
  alca.hidden = !(ehMovel() && alcaCabe() && no && cardFechado && controlesFechados);
  if (no) alca.querySelector(".alca-nome").innerHTML = `${iconeInline(categoriaDoNo(no), corDoNo(no))}${escapar(
    truncar(rotuloDoNo(no), 40)
  )}`;
}

function idDoNoAtual() {
  return historico.length > 0 ? historico[historico.length - 1].id : null;
}

// Qual aresta liga dois nos (em qualquer direcao). E o que transforma um
// salto no grafo em um passo com natureza declarada na trilha.
function arestaEntre(origemId, destinoId) {
  if (!origemId || origemId === destinoId) return null;
  const aresta = grafo.arestas.find(
    (a) =>
      (a.origem === origemId && a.destino === destinoId) ||
      (a.origem === destinoId && a.destino === origemId)
  );
  return aresta ? aresta.id : null;
}

// No celular, os painéis de filtros e detalhes viram "bottom sheets"
// abertos sob demanda (não cabem os dois flutuando ao mesmo tempo como no
// desktop) — só um fica visível por vez.
function configurarPaineisMoveis() {
  const controles = document.querySelector("#mapa-controles");
  const detalhes = document.querySelector("#detalhes");
  const btnFiltros = document.querySelector("#btn-filtros");
  const btnDetalhes = document.querySelector("#btn-abrir-detalhes");

  const aplicarEstadoInicial = () => {
    if (ehMovel()) {
      controles.classList.add("oculto");
      detalhes.classList.add("oculto");
    } else {
      controles.classList.remove("oculto");
      detalhes.classList.remove("oculto");
    }
    atualizarPressionado();
  };

  const atualizarPressionado = () => {
    btnFiltros.setAttribute("aria-pressed", String(!controles.classList.contains("oculto")));
    btnDetalhes.setAttribute("aria-pressed", String(!detalhes.classList.contains("oculto")));
  };

  btnFiltros.addEventListener("click", () => {
    if (ehMovel()) detalhes.classList.add("oculto");
    controles.classList.toggle("oculto");
    atualizarPressionado();
  });

  btnDetalhes.addEventListener("click", () => {
    if (ehMovel()) controles.classList.add("oculto");
    detalhes.classList.toggle("oculto");
    atualizarPressionado();
  });

  document.querySelectorAll(".fechar-painel").forEach((botao) => {
    botao.addEventListener("click", () => {
      document.querySelector(`#${botao.dataset.fechar}`).classList.add("oculto");
      atualizarPressionado();
    });
  });

  // A alça depende do estado dos dois painéis; observar a classe cobre
  // todos os caminhos que abrem ou fecham um deles (botões, X, toque no nó).
  const observador = new MutationObserver(atualizarAlca);
  observador.observe(controles, { attributes: true, attributeFilter: ["class"] });
  observador.observe(detalhes, { attributes: true, attributeFilter: ["class"] });
  document.querySelector("#alca-detalhes").addEventListener("click", abrirDetalhesSeMovel);

  aplicarEstadoInicial();
  // Só reaplica o padrão ao cruzar o breakpoint (não a cada resize —
  // no celular a barra de endereço aparecendo/sumindo dispara "resize" o
  // tempo todo e fecharia um painel que o usuário acabou de abrir).
  window.matchMedia("(max-width: 860px)").addEventListener("change", aplicarEstadoInicial);
}

function abrirDetalhesSeMovel() {
  if (!ehMovel()) return;
  document.querySelector("#mapa-controles").classList.add("oculto");
  document.querySelector("#detalhes").classList.remove("oculto");
  document.querySelector("#btn-filtros").setAttribute("aria-pressed", "false");
  document.querySelector("#btn-abrir-detalhes").setAttribute("aria-pressed", "true");
}

function configurarFerramentas() {
  const centro = () => ({ x: cy.width() / 2, y: cy.height() / 2 });
  document.querySelector("#btn-zoom-in").addEventListener("click", () => {
    cy.zoom({ level: cy.zoom() * 1.25, renderedPosition: centro() });
  });
  document.querySelector("#btn-zoom-out").addEventListener("click", () => {
    cy.zoom({ level: cy.zoom() / 1.25, renderedPosition: centro() });
  });
  document.querySelector("#btn-fit").addEventListener("click", () => cy.fit(undefined, 48));
  document.querySelector("#btn-reset-foco").addEventListener("click", () => {
    limparFoco();
    limparDetalhes();
  });
}

function limparFoco() {
  if (!cy) return;
  cy.batch(() => {
    cy.elements().removeClass("foco prof-0 prof-1 prof-2 prof-3");
    cy.nodes().forEach((n) => n.data("tamanhoVisual", n.data("tamanho")));
  });
  atualizarAlca();
}

function renderizarTrilha() {
  const trilha = document.querySelector("#trilha");
  if (historico.length <= 1) {
    trilha.hidden = true;
    return;
  }
  trilha.hidden = false;
  trilha.innerHTML = historico
    .map((passo, indice) => {
      const no = noPorId(passo.id);
      const rotulo = no ? rotuloDoNo(no) : passo.id;
      const atual = indice === historico.length - 1;
      const proximo = historico[indice + 1];
      const arestaDoPasso = proximo ? arestaPorId(proximo.aresta) : null;
      const relacao = arestaDoPasso ? descreverRelacao(arestaDoPasso, arestaDoPasso.origem === passo.id) : null;
      const separador = proximo
        ? `<span class="separador"${relacao ? ` title="${escapar(relacao)}"` : ""}>›${
            relacao ? `<em>${escapar(relacao)}</em>` : ""
          }</span>`
        : "";
      return `<button class="chip${atual ? " atual" : ""}" data-id="${passo.id}">${escapar(
        truncar(rotulo, 22)
      )}</button>${separador}`;
    })
    .join("");

  trilha.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const indice = historico.findIndex((h) => h.id === chip.dataset.id);
      historico = historico.slice(0, indice + 1);
      centralizarEm(chip.dataset.id, { registrarHistorico: false });
    });
  });
}

function nosDaCategoria(categoria) {
  return grafo.nos
    .filter((n) => categoriaDoNo(n) === categoria)
    .sort((a, b) => rotuloDoNo(a).localeCompare(rotuloDoNo(b)));
}

// Cada tipo da legenda leva a um nó daquele tipo. Clicar de novo no mesmo
// tipo passa para o próximo nó dele, em ordem alfabética, e volta ao
// primeiro no fim. Tipo sem nenhum nó fica desabilitado, não escondido: o
// vazio também é informação (seção 11 da metodologia).
// Recolher/expandir "Tipos de nó". A escolha fica no navegador de quem
// visita (conveniência pessoal, não dado); se o armazenamento estiver
// bloqueado, a seção só começa aberta.
const CHAVE_LEGENDA = "tudo-conectado:legenda-recolhida";

function configurarAlternarLegenda() {
  const botao = document.querySelector("#alternar-legenda");
  const legenda = document.querySelector("#legenda");
  if (!botao || !legenda || botao.dataset.configurado) return;
  botao.dataset.configurado = "1";

  const aplicar = (recolhida) => {
    legenda.hidden = recolhida;
    botao.setAttribute("aria-expanded", String(!recolhida));
    botao.title = recolhida ? "Mostrar os tipos de nó" : "Ocultar os tipos de nó";
  };
  let recolhida = false;
  try {
    recolhida = localStorage.getItem(CHAVE_LEGENDA) === "1";
  } catch {}
  aplicar(recolhida);

  botao.addEventListener("click", () => {
    const agora = botao.getAttribute("aria-expanded") === "true";
    aplicar(agora);
    try {
      localStorage.setItem(CHAVE_LEGENDA, agora ? "1" : "0");
    } catch {}
  });
}

// --- Mostrar/ocultar tipos de nó no mapa ---------------------------------------
// Ex.: ocultar tudo menos Livro e Objeto para ver só as ligações entre eles.
// Ocultar é só visual (classe tipo-oculto → display: none); o dado continua
// no grafo, na busca e no card.

const tiposOcultos = new Set();

const ICONE_OLHO =
  '<svg viewBox="0 0 24 24" class="icone" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>';
const ICONE_OLHO_FECHADO =
  '<svg viewBox="0 0 24 24" class="icone" aria-hidden="true"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>';

function aplicarTiposOcultos() {
  if (!cy) return;
  cy.batch(() => {
    cy.nodes().forEach((n) => n.toggleClass("tipo-oculto", tiposOcultos.has(categoriaDoNo(n.data()))));
  });
  document.querySelectorAll(".linha-legenda").forEach((linha) => {
    const oculto = tiposOcultos.has(linha.dataset.categoria);
    const rotulo = ROTULO_CATEGORIA[linha.dataset.categoria];
    linha.classList.toggle("tipo-oculto", oculto);
    const olho = linha.querySelector(".alternar-tipo");
    if (!olho) return;
    olho.innerHTML = oculto ? ICONE_OLHO_FECHADO : ICONE_OLHO;
    olho.setAttribute("aria-pressed", String(oculto));
    const acao = `${oculto ? "Mostrar" : "Ocultar"} ${rotulo} no mapa`;
    olho.setAttribute("aria-label", acao);
    olho.title = acao;
  });
  const mostrarTodos = document.querySelector("#mostrar-todos-tipos");
  if (mostrarTodos) mostrarTodos.hidden = tiposOcultos.size === 0;
}

// Depois de mudar o que está visível, refaz a cena: se o nó em foco
// continua visível, re-centraliza nele; se ele sumiu, enquadra o que sobrou.
function reorganizarAposVisibilidade() {
  const emFoco = cy.nodes(".foco");
  // Pelo estado, e não por emFoco.visible(): logo depois de trocar a classe,
  // o Cytoscape ainda não recalculou o estilo e o nó recém-oculto responde
  // "visível" — e centralizarEm o revelaria de novo.
  if (emFoco.nonempty() && !tiposOcultos.has(categoriaDoNo(emFoco.data()))) {
    centralizarEm(emFoco.id(), { registrarHistorico: false, forcarLayout: true, abrirPainel: false });
    return;
  }
  limparFoco();
  limparDetalhes();
  if (cy.nodes(":visible").nonempty()) rodarLayout(null);
}

function alternarTipo(categoria) {
  if (tiposOcultos.has(categoria)) tiposOcultos.delete(categoria);
  else tiposOcultos.add(categoria);
  aplicarTiposOcultos();
  reorganizarAposVisibilidade();
}

function montarLegenda() {
  configurarAlternarLegenda();
  const legenda = document.querySelector("#legenda");
  legenda.innerHTML =
    Object.entries(ROTULO_CATEGORIA)
      .map(([categoria, rotulo]) => {
        const total = nosDaCategoria(categoria).length;
        const dica =
          total === 0 ? "Nenhum nó deste tipo ainda" : `Ir para ${plural(total, "nó", "nós")} do tipo ${rotulo}`;
        // Dois botões lado a lado (e não um dentro do outro): o nome navega,
        // o olho mostra/oculta o tipo no mapa.
        const olho =
          total === 0
            ? '<span class="alternar-tipo-vaga" aria-hidden="true"></span>'
            : `<button type="button" class="alternar-tipo" data-categoria="${categoria}" aria-pressed="false"></button>`;
        return `<div class="linha-legenda" data-categoria="${categoria}"><button type="button" class="item-legenda" data-categoria="${categoria}" title="${escapar(
          dica
        )}"${total === 0 ? " disabled" : ""}>${iconeInline(categoria, corDaCategoria(categoria))}<span>${rotulo}</span><span class="contagem">${total}</span></button>${olho}</div>`;
      })
      .join("") + '<button type="button" id="mostrar-todos-tipos" class="mostrar-todos" hidden>Mostrar todos os tipos</button>';

  legenda.querySelectorAll(".alternar-tipo").forEach((botao) => {
    botao.addEventListener("click", () => alternarTipo(botao.dataset.categoria));
  });
  legenda.querySelector("#mostrar-todos-tipos").addEventListener("click", () => {
    tiposOcultos.clear();
    aplicarTiposOcultos();
    reorganizarAposVisibilidade();
  });
  aplicarTiposOcultos();

  legenda.querySelectorAll(".item-legenda:not([disabled])").forEach((botao) => {
    botao.addEventListener("click", () => {
      const nos = nosDaCategoria(botao.dataset.categoria);
      const posicao = nos.findIndex((n) => n.id === idDoNoAtual());
      const proximo = nos[(posicao + 1) % nos.length];
      centralizarEm(proximo.id, { viaAresta: arestaEntre(idDoNoAtual(), proximo.id) });
    });
  });
}

function montarSeletorRaiz() {
  const seletor = document.querySelector("#seletor-raiz");
  const rotulo = document.querySelector("#rotulo-passagem");
  const raizes = grafo.nos
    .filter((n) => n.tipo === "passagem" || LIVROS_RAIZ.includes(n.id))
    .sort((a, b) => rotuloDoNo(a).localeCompare(rotuloDoNo(b)));

  rotulo.hidden = raizes.length === 0;
  if (raizes.length === 0) return;

  seletor.innerHTML = raizes.map((n) => `<option value="${n.id}">${escapar(rotuloDoNo(n))}</option>`).join("");
  seletor.addEventListener("change", () => centralizarEm(seletor.value));
}

function montarFiltros() {
  const forcas = [...new Set(grafo.arestas.map((a) => a.forca).filter(Boolean))];
  const tipos = [...new Set(grafo.arestas.map((a) => a.tipo).filter(Boolean))];

  const campoForca = document.querySelector("#filtro-forca");
  campoForca.querySelectorAll(".opcao-filtro").forEach((el) => el.remove());
  forcas.forEach((forca) => campoForca.appendChild(criarFiltro("forca", forca, estiloAmostra(forca))));

  const campoTipo = document.querySelector("#filtro-tipo");
  campoTipo.querySelectorAll(".opcao-filtro").forEach((el) => el.remove());
  tipos.forEach((tipo) => campoTipo.appendChild(criarFiltro("tipo", tipo)));
}

function criarFiltro(atributo, valor, estiloLinha) {
  const label = document.createElement("label");
  label.className = "opcao-filtro";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = true;
  input.dataset.atributo = atributo;
  input.dataset.valor = valor;
  input.addEventListener("change", aplicarFiltros);
  label.appendChild(input);
  if (estiloLinha) {
    const amostra = document.createElement("span");
    amostra.className = "amostra-linha";
    amostra.setAttribute("style", estiloLinha);
    label.appendChild(amostra);
  }
  const texto = document.createElement("span");
  texto.className = "rotulo-filtro";
  texto.textContent = atributo === "forca" ? rotuloForca(valor) : rotuloFiltroTipo(valor);
  label.appendChild(texto);
  return label;
}

function aplicarFiltros() {
  if (!cy) return;
  const desligados = { forca: new Set(), tipo: new Set() };
  document.querySelectorAll("#filtro-forca input, #filtro-tipo input").forEach((input) => {
    if (!input.checked) desligados[input.dataset.atributo].add(input.dataset.valor);
  });

  cy.edges().forEach((aresta) => {
    const escondida =
      (aresta.data("forca") && desligados.forca.has(aresta.data("forca"))) ||
      (aresta.data("tipo") && desligados.tipo.has(aresta.data("tipo")));
    aresta.toggleClass("escondido", escondida);
  });

  // A profundidade é medida pelas arestas visíveis — esconder uma muda quem
  // fica perto de quem.
  const emFoco = cy.nodes(".foco");
  if (emFoco.nonempty()) aplicarProfundidade(emFoco.id());
}

// --- Busca -------------------------------------------------------------------

function configurarBusca() {
  const input = document.querySelector("#busca-input");
  const resultados = document.querySelector("#busca-resultados");

  input.addEventListener("input", () => {
    const termo = input.value.trim().toLowerCase();
    if (!termo) {
      resultados.hidden = true;
      resultados.innerHTML = "";
      return;
    }

    const achados = grafo.nos.filter((no) => rotuloDoNo(no).toLowerCase().includes(termo)).slice(0, 8);

    resultados.innerHTML =
      achados.length === 0
        ? '<li class="vazio-busca">Nada encontrado.</li>'
        : achados
            .map(
              (no) => `
              <li>
                <button data-id="${no.id}">
                  ${iconeInline(categoriaDoNo(no), corDoNo(no))}
                  ${escapar(rotuloDoNo(no))}
                  <span class="etiqueta">${escapar(ROTULO_CATEGORIA[categoriaDoNo(no)] || no.tipo)}</span>
                </button>
              </li>`
            )
            .join("");
    resultados.hidden = false;

    resultados.querySelectorAll("button").forEach((botao) => {
      botao.addEventListener("click", () => {
        mudarView("mapa");
        centralizarEm(botao.dataset.id);
        input.value = "";
        resultados.hidden = true;
      });
    });
  });

  document.addEventListener("click", (evento) => {
    if (!evento.target.closest(".busca")) resultados.hidden = true;
  });
}

function corDoNo(no) {
  return corDaCategoria(categoriaDoNo(no));
}

// --- Índice derivado por nó --------------------------------------------------

function noPorId(id) {
  return grafo.nos.find((n) => n.id === id) || null;
}

function arestaPorId(id) {
  return grafo.arestas.find((a) => a.id === id) || null;
}

function unicosPorId(nos) {
  const vistos = new Map();
  for (const no of nos) if (!vistos.has(no.id)) vistos.set(no.id, no);
  return [...vistos.values()];
}

// Tudo que o card e o dossiê mostram é DERIVADO do grafo — nenhum campo novo
// foi criado em schema/ para isso. A datação de um Registro são as datações
// das Afirmações ligadas a ele; o local são os Registros tipo=lugar
// conectados; as fontes são as das ligações incidentes, creditadas à ligação
// de origem. Um campo editorial aqui seria conteúdo sem fonte dentro de um
// projeto cujo princípio é que nada entra sem fonte.
function indiceDoNo(no) {
  const conexoes = [];
  for (const aresta of grafo.arestas) {
    if (aresta.origem !== no.id && aresta.destino !== no.id) continue;
    const saindo = aresta.origem === no.id;
    const outro = noPorId(saindo ? aresta.destino : aresta.origem);
    if (!outro) continue;
    // Arestas 'cita'/'envolve' são estruturais: não têm força nem fonte, e
    // por isso nunca recebem badge de evidência (ver seção 5 da issue #1).
    conexoes.push({ aresta, outro, saindo, ehEvidencia: Boolean(aresta.forca) });
  }

  const ligacoes = conexoes.filter((c) => c.ehEvidencia);
  const estruturais = conexoes.filter((c) => !c.ehEvidencia);

  const afirmacoesRelacionadas = unicosPorId([
    ...(no.tipo === "afirmacao" ? [no] : []),
    ...conexoes.filter((c) => c.outro.tipo === "afirmacao").map((c) => c.outro),
  ]);

  const datacoes = afirmacoesRelacionadas
    .flatMap((a) => (a.datacao || []).map((d) => ({ ...d, afirmacao: a })))
    .sort((a, b) => a.periodo[0] - b.periodo[0]);

  const lugares = unicosPorId(conexoes.filter((c) => c.outro.subtipo === "lugar").map((c) => c.outro));
  const passagens = unicosPorId(conexoes.filter((c) => c.outro.tipo === "passagem").map((c) => c.outro));

  const fontes = ligacoes.flatMap((c) => (c.aresta.fontes || []).map((f) => ({ ...f, aresta: c.aresta })));

  const limites = ligacoes
    .filter((c) => c.aresta.o_que_derrubaria || c.aresta.notas || c.aresta.justificativa_copia)
    .map((c) => ({ aresta: c.aresta, outro: c.outro, saindo: c.saindo }));

  return { conexoes, ligacoes, estruturais, afirmacoesRelacionadas, datacoes, lugares, passagens, fontes, limites };
}

// --- Vocabulário: só o que o schema define -----------------------------------

const ROTULO_FORCA = {
  bem_estabelecido: "Bem estabelecido",
  aceito_maioria: "Aceito pela maioria",
  disputado: "Disputado",
  poucos: "Poucos sustentam",
  especulacao: "Especulação",
};

const ROTULO_APOIO = {
  texto: "Evidência textual",
  inscricao: "Inscrição",
  achado_arqueologico: "Achado arqueológico",
  moedas: "Moedas",
  analise_linguistica: "Análise linguística",
  medicao_cientifica: "Medição científica",
  nenhum: "Sem apoio material",
};

// Ícones da Lucide usados pelos blocos do card (os de tipo de nó estão em ICONES).
const ICONES_UI = {
  datacao: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  local:
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  conexoes:
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  fontes: '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
  evidencia: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  caminho:
    '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  // Tela de leitura (Lucide, MIT): languages, git-compare, globe, atom,
  // book-open, arrow-left.
  traducao:
    '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  variante:
    '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/>',
  paralelo:
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  ciencia:
    '<circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/>',
  leitura:
    '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  voltar: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  limites:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
};

function iconeUI(nome) {
  return `<svg viewBox="0 0 24 24" class="icone" aria-hidden="true">${ICONES_UI[nome] || ""}</svg>`;
}

// --- Fontes e citações como links ----------------------------------------------

const ICONE_EXTERNO =
  '<svg viewBox="0 0 24 24" class="icone icone-externo" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';

// Só https e só o que veio do campo 'url' da fonte (ver ligacao.schema.json).
// O schema já exige isso; a checagem repetida aqui impede que um grafo.json
// adulterado vire um link javascript: na página.
function urlSegura(url) {
  return typeof url === "string" && /^https:\/\/\S+$/.test(url) ? url : null;
}

// A descrição da fonte vira link para onde ela pode ser consultada, quando
// a fonte tem 'url'. Sem url, continua texto: link deduzido seria fonte
// inventada.
function htmlFonte(fonte) {
  const url = urlSegura(fonte.url);
  if (!url) return escapar(fonte.descricao);
  return `<a class="fonte-link" href="${escapar(url)}" target="_blank" rel="noopener noreferrer" title="Abrir a fonte (nova aba)">${escapar(
    fonte.descricao
  )}${ICONE_EXTERNO}</a>`;
}

// Atributo que marca o item de uma fonte na lista, para uma citação poder
// apontar para ele (ver ligarAcoesDoPainel).
function marcaFonte(aresta) {
  return `data-fonte-ligacao="${aresta.ligacao || aresta.id}"`;
}

// Trechos entre aspas (curvas, retas duplas ou « ») viram destaque. O apóstrofo
// reto fica de fora de propósito: "Bil'am" não é citação.
const PADRAO_CITACAO = /“[^”]+”|"[^"]+"|‘[^’]+’|«[^»]+»/g;

// Toda citação é destacada; vira link quando a origem é inequívoca pelos
// dados — o texto pertence a uma ligação e essa ligação declara fontes.
// Uma fonte com url: link para ela. Senão: link para a lista de fontes da
// ligação no próprio painel. Texto de Registro não declara fonte, então a
// citação ali fica só destacada, e o title diz isso — atribuir uma fonte
// "provável" seria inventar a origem da citação.
function comCitacoes(texto, aresta = null) {
  const fontes = aresta?.fontes || [];
  const unica = fontes.length === 1 ? urlSegura(fontes[0].url) : null;
  let html = "";
  let ultimo = 0;
  for (const achado of (texto || "").matchAll(PADRAO_CITACAO)) {
    // Nome de campo entre aspas ("forca: aceito_maioria") é referência
    // técnica, não citação de uma fonte — marcar como citação linkada às
    // fontes da ligação diria que a fonte escreveu aquilo.
    if (/[a-z]_[a-z]/.test(achado[0])) continue;
    html += escapar(texto.slice(ultimo, achado.index));
    const trecho = escapar(achado[0]);
    if (unica) {
      html += `<a class="citacao" href="${escapar(unica)}" target="_blank" rel="noopener noreferrer" title="Citação — abrir a fonte (nova aba)">${trecho}</a>`;
    } else if (fontes.length > 0) {
      html += `<a class="citacao" href="#" data-ir-fonte="${aresta.ligacao || aresta.id}" title="Citação — ver ${
        fontes.length === 1 ? "a fonte" : "as fontes"
      } desta ligação">${trecho}</a>`;
    } else {
      html += `<span class="citacao" title="Citação sem fonte indicada nos dados">${trecho}</span>`;
    }
    ultimo = achado.index + achado[0].length;
  }
  return html + escapar((texto || "").slice(ultimo));
}

function rotuloForca(forca) {
  return ROTULO_FORCA[forca] || (forca || "—").replace(/_/g, " ");
}

function rotuloApoio(apoio) {
  return apoio ? ROTULO_APOIO[apoio] || apoio.replace(/_/g, " ") : null;
}

function rotuloTipoLigacao(tipo) {
  return (tipo || "").replace(/_/g, " ");
}

const ehEstrutural = (tipo) => tipo === "cita" || tipo === "envolve" || tipo === "parte_de";

// No filtro, a primeira letra maiúscula vem daqui (e não de um
// text-transform: capitalize, que também capitalizava "de" em "Foi Copiado
// De"). Os estruturais avisam que não são evidência.
function rotuloFiltroTipo(tipo) {
  const texto = rotuloTipoLigacao(tipo);
  const capitalizado = texto.charAt(0).toUpperCase() + texto.slice(1);
  return ehEstrutural(tipo) ? `${capitalizado} (estrutural)` : capitalizado;
}

// Nome legível de uma ligação, para creditar uma fonte a ela sem mostrar o
// id interno ("6qpaleogen-confirma-genesis") para quem lê.
function rotuloLigacao(aresta) {
  // Uma afirmação é uma frase inteira; sem aspas, "X confirma Gênesis foi
  // escrito por Moisés." não se lê como uma frase só.
  const ponta = (id) =>
    noPorId(id)?.tipo === "afirmacao" ? `“${rotuloPorId(id).replace(/\.$/, "")}”` : rotuloPorId(id);
  return `${ponta(aresta.origem)} ${verboDaLigacao(aresta.tipo)} ${ponta(aresta.destino)}`;
}

// Como uma aresta estrutural se lê a partir do nó em foco. "envolve" e
// "cita", soltos, não dizem ao leitor o que a ligação significa.
function relacaoEstrutural(aresta, saindo) {
  if (aresta.tipo === "envolve") return saindo ? "tema desta afirmação" : "afirmação sobre este item";
  if (aresta.tipo === "cita") return saindo ? "citado nesta passagem" : "passagem que cita este item";
  if (aresta.tipo === "parte_de") return saindo ? "livro de que esta passagem faz parte" : "passagem deste livro";
  return rotuloTipoLigacao(aresta.tipo);
}

// Datas de escala geológica ou cósmica (a idade da Terra, do universo) não
// se leem em "4580000000 a.C.": viram "há 4,58 bilhões de anos".
function formatarAno(ano) {
  const distancia = Math.abs(ano);
  // Pré-história: "há 315 mil anos" em vez de "315000 a.C.".
  if (ano < 0 && distancia >= 1e4 && distancia < 1e6) {
    return `há ${Math.round(distancia / 1000).toLocaleString("pt-BR")} mil anos`;
  }
  if (ano < 0 && distancia >= 1e6) {
    const [valor, unidade] = distancia >= 1e9 ? [distancia / 1e9, "bilhões"] : [distancia / 1e6, "milhões"];
    const numero = valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
    return `há ${numero} ${unidade} de anos`;
  }
  return ano < 0 ? `${distancia} a.C.` : `${ano} d.C.`;
}

function formatarPeriodo(periodo) {
  if (!Array.isArray(periodo) || periodo.length < 2) return "";
  const [inicio, fim] = periodo;
  if (inicio === fim) return formatarAno(inicio);
  // "há 349 mil anos – há 281 mil anos" vira "há 349 a 281 mil anos".
  const [a, b] = [formatarAno(inicio), formatarAno(fim)];
  const mesmaEscala = /^há (.+?) (mil anos|milhões de anos|bilhões de anos)$/;
  const [ma, mb] = [mesmaEscala.exec(a), mesmaEscala.exec(b)];
  if (ma && mb && ma[2] === mb[2]) return `há ${ma[1]} a ${mb[1]} ${ma[2]}`;
  return `${a} – ${b}`;
}

// A ligação tem sentido: origem é quem confirma/contradiz/foi copiado,
// destino é o alvo (regra checada por validarDirecaoDeLigacao). Lida a partir
// do alvo, a relação vira a voz passiva — "confirmado por", não "confirma".
const VOZ_PASSIVA = {
  confirma: "confirmado por",
  contradiz: "contradito por",
  foi_copiado_de: "copiado por",
  paralelo: "tem paralelo em",
};

// "X paralelo Y" não é português; o verbo lido da origem precisa de ajuste.
const VOZ_ATIVA = { paralelo: "tem paralelo com" };

function verboDaLigacao(tipo, lidoDaOrigem = true) {
  if (!lidoDaOrigem && VOZ_PASSIVA[tipo]) return VOZ_PASSIVA[tipo];
  return VOZ_ATIVA[tipo] || rotuloTipoLigacao(tipo);
}

// Natureza da relação, sempre a partir dos dados: tipo da ligação + tipo de
// apoio. Nunca uma classificação inventada no frontend. `lidoDaOrigem` diz
// de que ponta o leitor está olhando (padrão: da origem, voz ativa).
function descreverRelacao(arestaOuId, lidoDaOrigem = true) {
  const aresta = typeof arestaOuId === "string" ? arestaPorId(arestaOuId) : arestaOuId;
  if (!aresta) return null;
  const partes = [verboDaLigacao(aresta.tipo, lidoDaOrigem)];
  const apoio = rotuloApoio(aresta.tipo_de_apoio);
  if (apoio && aresta.tipo_de_apoio !== "nenhum") partes.push(apoio.toLowerCase());
  return partes.join(" · ");
}

// --- Painel de detalhes ------------------------------------------------------

function classePill(forca) {
  if (forca === "bem_estabelecido" || forca === "aceito_maioria") return "pill-forte";
  if (forca === "disputado" || forca === "poucos") return "pill-media";
  return "pill-fraca";
}

function eyebrow(cor, rotulo) {
  return `<p class="eyebrow"><span class="ponto" style="background:${cor};color:${cor}"></span>${escapar(rotulo)}</p>`;
}

function eyebrowNo(no) {
  const categoria = categoriaDoNo(no);
  return `<p class="eyebrow eyebrow-icone" style="color:${corDoNo(no)}">${iconeInline(categoria)}${escapar(
    ROTULO_CATEGORIA[categoria] || no.tipo
  )}</p>`;
}

function secao(icone, titulo, corpo) {
  if (!corpo) return "";
  return `<section class="bloco-card"><h3>${iconeUI(icone)}${escapar(titulo)}</h3>${corpo}</section>`;
}

// --- Blocos do card ----------------------------------------------------------
// Cada bloco devolve "" quando não há dado correspondente: bloco sem dado é
// omitido, nunca preenchido com placeholder.

function blocoMeta(no, idx) {
  const linhas = [];

  if (idx.datacoes.length > 0) {
    // A datação nunca aparece sem o 'segundo_quem': mostrar a data sozinha
    // transformaria interpretação em fato (seção 5 da metodologia).
    // Num Registro, a datação vem de uma Afirmação ligada a ele — e não é
    // "a data do Registro". Sem dizer de qual afirmação é, "1446–1200 a.C."
    // debaixo de "Gênesis" parecia a data do livro.
    // O texto de datação é uma narrativa que começa dizendo o que é datado
    // e segundo quem (guia de estilo, "Narrativa histórica"); o card mostra
    // a primeira frase e guarda o resto em "Continuar lendo".
    const itens = idx.datacoes
      .slice(0, 2)
      .map((d) => {
        const [inicio, resto] = primeiraFrase(d.segundo_quem.trim());
        const mais = resto
          ? `<details class="mais"><summary>Continuar lendo</summary><p>${comCitacoes(resto)}</p></details>`
          : "";
        return `<li><strong>${escapar(formatarPeriodo(d.periodo))}</strong><span class="datacao-texto">${comCitacoes(
          inicio
        )}</span>${mais}</li>`;
      })
      .join("");
    const extra =
      idx.datacoes.length > 2
        ? `<li class="etiqueta">+${plural(idx.datacoes.length - 2, "datação", "datações")} na ficha completa</li>`
        : "";
    linhas.push(`<div class="meta-linha">${iconeUI("datacao")}<ul class="meta-lista">${itens}${extra}</ul></div>`);
  }

  if (idx.lugares.length > 0) {
    linhas.push(
      `<div class="meta-linha">${iconeUI("local")}<span>${idx.lugares
        .map((l) => escapar(l.nome))
        .join(" · ")}</span></div>`
    );
  }

  return linhas.length > 0 ? `<div class="meta">${linhas.join("")}</div>` : "";
}

// Nível 1 mostra o começo; nível 2 ("Continuar lendo") mostra o resto sem
// tirar o usuário do grafo. Até DESCRICAO_INTEIRA_ATE o texto cabe inteiro
// no card; acima disso, corta no fim de uma frase.
const DESCRICAO_INTEIRA_ATE = 480;
const DESCRICAO_CORTE_ALVO = 360;

// Fins de frase onde dá para cortar: pontuação final seguida de espaço e
// maiúscula. Iniciais ("Joel S. Baden") não contam, e o corte nunca cai
// dentro de aspas.
function finsDeFrase(texto) {
  const fins = [];
  const padrao = /[.!?]["”»)]?\s+(?=[A-ZÀ-Ý])/g;
  let achado;
  while ((achado = padrao.exec(texto))) {
    const antes = texto.slice(0, achado.index + 1);
    const ultimaPalavra = antes.split(/\s/).pop();
    if (/^[A-ZÀ-Ý]\.$/.test(ultimaPalavra)) continue;
    const aspas = (antes.match(/["“”]/g) || []).length;
    if (aspas % 2 !== 0) continue;
    fins.push(achado.index + achado[0].length);
  }
  return fins;
}

// Divide em [início, resto]; resto vazio quando o texto cabe inteiro ou
// não tem onde cortar sem partir uma frase.
function dividirNaFrase(texto) {
  if (texto.length <= DESCRICAO_INTEIRA_ATE) return [texto, ""];
  const fins = finsDeFrase(texto);
  const corte = fins.filter((f) => f <= DESCRICAO_CORTE_ALVO).pop() ?? fins[0];
  if (!corte || corte >= texto.length) return [texto, ""];
  return [texto.slice(0, corte).trim(), texto.slice(corte).trim()];
}

// Primeira frase e o resto, pelo mesmo critério de fim de frase da descrição.
function primeiraFrase(texto) {
  const fim = finsDeFrase(texto)[0];
  if (!fim || fim >= texto.length) return [texto, ""];
  return [texto.slice(0, fim).trim(), texto.slice(fim).trim()];
}

function blocoDescricao(no) {
  const texto = (no.descricao || no.texto || "").trim();
  if (!texto) return "";
  const [inicio, resto] = dividirNaFrase(texto);
  if (!resto) return `<p class="descricao">${comCitacoes(texto)}</p>`;
  return `
    <p class="descricao">${comCitacoes(inicio)}</p>
    <details class="mais"><summary>Continuar lendo</summary><p class="descricao">${comCitacoes(resto)}</p></details>`;
}

const ESTE_ITEM = {
  livro: "este livro",
  texto: "este texto",
  passagem: "esta passagem",
  afirmacao: "esta afirmação",
  pessoa: "esta pessoa",
  lugar: "este lugar",
  acontecimento: "este acontecimento",
  objeto: "este objeto",
};

// "Por que está aqui" derivado das ligações incidentes e seus tipos — não
// prosa editorial (ver seção 0 da issue #1).
function blocoRelevancia(no, idx) {
  if (idx.ligacoes.length === 0) return "";
  // Nomeia com quem é cada ligação — "confirma (1)" sozinho não dizia o
  // que confirma o quê.
  // Uma frase por ligação, com sujeito e verbo, na direção da seta:
  // "6QpaleoGen confirma este livro.", "Este livro confirma X."
  const aqui = ESTE_ITEM[categoriaDoNo(no)] || "este item";
  const frases = idx.ligacoes.map((c) => {
    const outro = rotuloDoNo(c.outro);
    const verbo = verboDaLigacao(c.aresta.tipo);
    const frase = c.saindo ? `${aqui} ${verbo} ${outro}` : `${outro} ${verbo} ${aqui}`;
    return `${frase.charAt(0).toUpperCase()}${frase.slice(1)}.`;
  });
  return `<p class="relevancia">${escapar(frases.join(" "))}</p>`;
}

function itemConexao(conexao) {
  const { aresta, outro, ehEvidencia, saindo } = conexao;
  const relacao = ehEvidencia
    ? descreverRelacao(aresta, saindo) || rotuloTipoLigacao(aresta.tipo)
    : relacaoEstrutural(aresta, saindo);
  const badge = ehEvidencia
    ? `<span class="pill ${classePill(aresta.forca)}" title="Força do apoio">${escapar(rotuloForca(aresta.forca))}</span>`
    : '<span class="pill pill-contexto" title="Ligação estrutural: não tem força de evidência nem fonte">Estrutural</span>';
  return `
    <li class="conexao">
      <button class="ir-para-no" data-id="${outro.id}" data-aresta="${aresta.id}">
        <span class="conexao-nome">${iconeInline(categoriaDoNo(outro), corDoNo(outro))}${escapar(
          truncar(rotuloDoNo(outro), 34)
        )}</span>
        <span class="conexao-relacao">${escapar(relacao)}</span>
      </button>
      ${badge}
    </li>`;
}

function blocoConexoes(no, idx, { limite = 5 } = {}) {
  if (idx.conexoes.length === 0) return "";
  // Ligações com evidência primeiro; estruturais depois, como contexto.
  const ordenadas = [...idx.ligacoes, ...idx.estruturais];
  const visiveis = ordenadas.slice(0, limite);
  const resto = ordenadas.length - visiveis.length;
  return secao(
    "conexoes",
    "Conexões principais",
    `<ul class="conexoes">${visiveis.map(itemConexao).join("")}</ul>${
      resto > 0 ? `<p class="etiqueta">+${plural(resto, "conexão", "conexões")} na ficha completa</p>` : ""
    }`
  );
}

function blocoEvidencias(no, idx) {
  if (idx.ligacoes.length === 0) return "";
  const grupos = new Map();
  for (const c of idx.ligacoes) {
    const chave = c.aresta.tipo_de_apoio || "nenhum";
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(c);
  }
  const itens = [...grupos.entries()]
    .map(
      ([apoio, cs]) =>
        `<li><strong>${escapar(rotuloApoio(apoio))}</strong><span class="etiqueta">${cs
          .map((c) => `${escapar(verboDaLigacao(c.aresta.tipo, c.saindo))} ${escapar(rotuloDoNo(c.outro))}`)
          .join(" · ")}</span></li>`
    )
    .join("");
  return secao("evidencia", "Tipo de evidência", `<ul>${itens}</ul>`);
}

function blocoFontes(no, idx) {
  if (idx.fontes.length === 0) return "";
  const itens = idx.fontes
    .map(
      (f) =>
        `<li ${marcaFonte(f.aresta)}><span class="nivel-fonte">nível ${f.nivel}</span>${htmlFonte(
          f
        )}<span class="etiqueta">na ligação ${escapar(rotuloLigacao(f.aresta))}</span></li>`
    )
    .join("");
  return secao(
    "fontes",
    "Fontes",
    `<details class="mais"><summary>Ver ${plural(idx.fontes.length, "fonte", "fontes")}</summary><ul>${itens}</ul></details>`
  );
}

function blocoAfirma(no) {
  const itens = (no.afirma || []).map((a) => `<li>${comCitacoes(a)}</li>`).join("");
  return itens ? secao("evidencia", "O que a passagem afirma", `<ul>${itens}</ul>`) : "";
}

function blocoParalelo(no) {
  return no.nenhum_paralelo_conhecido ? '<p class="cartao-aviso">Nenhum paralelo externo conhecido.</p>' : "";
}

function blocoPassagens(no, idx) {
  if (idx.passagens.length === 0) return "";
  const itens = idx.passagens
    .map(
      (p) =>
        `<li class="conexao"><button class="ir-para-no" data-id="${p.id}"><span class="conexao-nome">${escapar(
          p.referencia
        )}</span></button></li>`
    )
    .join("");
  return secao("conexoes", "Passagens relacionadas", `<ul class="conexoes">${itens}</ul>`);
}

function blocoDatacoesCompletas(no, idx) {
  if (idx.datacoes.length === 0) return "";
  const itens = idx.datacoes
    .map(
      (d) =>
        `<li><strong>${escapar(formatarPeriodo(d.periodo))}</strong><span class="datacao-texto">${comCitacoes(
          d.segundo_quem.trim()
        )}</span></li>`
    )
    .join("");
  return secao("datacao", "Datação", `<ul>${itens}</ul>`);
}

// Seção 4 da issue: "por que estou vendo isso?" — o caminho até o elemento,
// com a natureza de cada passo, a partir do histórico de navegação.
function blocoCaminho(no) {
  const ate = historico.findIndex((h) => h.id === no.id);
  const ateAqui = ate >= 0 ? historico.slice(0, ate + 1) : historico;
  // Um passo sem aresta é um salto (busca, legenda, seletor), não uma
  // ligação percorrida: o caminho honesto começa no último salto. Sem isso,
  // pular de tipo em tipo pela legenda virava uma "trilha" que não existe.
  let inicio = 0;
  ateAqui.forEach((passo, i) => {
    if (i > 0 && !passo.aresta) inicio = i;
  });
  const caminho = ateAqui.slice(inicio);
  if (caminho.length <= 1) return "";
  const passos = caminho
    .map((passo, indice) => {
      const outro = noPorId(passo.id);
      const rotulo = outro ? rotuloDoNo(outro) : passo.id;
      const arestaDoPasso = indice > 0 ? arestaPorId(passo.aresta) : null;
      const relacao = arestaDoPasso
        ? descreverRelacao(arestaDoPasso, arestaDoPasso.origem === caminho[indice - 1].id)
        : null;
      return `${relacao ? `<li class="passo-relacao">${escapar(relacao)}</li>` : ""}<li class="passo-no">${escapar(
        truncar(rotulo, 40)
      )}</li>`;
    })
    .join("");
  return secao("caminho", "Você chegou aqui através de", `<ol class="caminho">${passos}</ol>`);
}

function blocoAcoes(no) {
  // Uma passagem com texto cadastrado ganha a ação principal de ler o capítulo.
  const ler = no.texto
    ? `<button class="abrir-leitura" data-texto="${escapar(no.texto)}">${iconeUI("leitura")}Ler o capítulo</button>`
    : "";
  return `<div class="acoes-card">${ler}<button class="abrir-dossie" data-id="${no.id}">Ver ficha completa</button></div>`;
}

// A seção que impede uma conexão de ser lida como afirmação mais forte do que
// os dados permitem: 'notas' e 'o_que_derrubaria', que já existiam nos YAML e
// só agora chegam à interface.
function blocoLimites(limites) {
  if (!limites || limites.length === 0) return "";
  const itens = limites
    .map(({ aresta, outro, saindo }) => {
      const cabecalho =
        outro && limites.length > 1
          ? `<p class="limite-origem">${escapar(verboDaLigacao(aresta.tipo, saindo))} ${escapar(
              rotuloDoNo(outro)
            )}</p>`
          : "";
      const notas = aresta.notas
        ? `<p><strong>O que essa evidência não demonstra:</strong> ${comCitacoes(aresta.notas.trim(), aresta)}</p>`
        : "";
      const derrubaria = aresta.o_que_derrubaria
        ? `<p><strong>O que derrubaria isso:</strong> ${comCitacoes(aresta.o_que_derrubaria.trim(), aresta)}</p>`
        : "";
      const copia = aresta.justificativa_copia
        ? `<p><strong>Justificativa de cópia:</strong> semelhança — ${comCitacoes(
            aresta.justificativa_copia.semelhanca_especifica,
            aresta
          )}; anterioridade — ${comCitacoes(aresta.justificativa_copia.anterioridade_comprovada, aresta)}; caminho — ${comCitacoes(aresta.justificativa_copia.caminho_plausivel, aresta)}</p>`
        : "";
      return `<div class="limite">${cabecalho}${notas}${derrubaria}${copia}</div>`;
    })
    .join("");
  return `<section class="bloco-card cartao-insight"><p class="cartao-insight-cabecalho">${iconeUI(
    "limites"
  )}Limites desta evidência</p>${itens}</section>`;
}

// Cada tipo prioriza o que é relevante à sua natureza — chaveado nos tipos que
// o schema realmente prevê (os 5 subtipos de Registro, mais afirmacao,
// passagem e o livro-raiz), nunca num vocabulário inventado.
const BLOCOS_POR_CATEGORIA = {
  livro: ["descricao", "meta", "relevancia", "passagens", "conexoes", "fontes"],
  texto: ["descricao", "meta", "relevancia", "passagens", "conexoes", "fontes"],
  pessoa: ["meta", "descricao", "relevancia", "conexoes", "fontes"],
  lugar: ["descricao", "relevancia", "conexoes", "fontes"],
  acontecimento: ["meta", "descricao", "evidencias", "conexoes", "fontes"],
  objeto: ["meta", "descricao", "evidencias", "conexoes", "fontes"],
  afirmacao: ["datacoesCompletas", "relevancia", "evidencias", "conexoes", "fontes"],
  passagem: ["afirma", "paralelo", "meta", "conexoes", "fontes"],
};

const BLOCOS = {
  meta: blocoMeta,
  descricao: blocoDescricao,
  relevancia: blocoRelevancia,
  conexoes: blocoConexoes,
  evidencias: blocoEvidencias,
  fontes: blocoFontes,
  afirma: blocoAfirma,
  paralelo: blocoParalelo,
  passagens: blocoPassagens,
  datacoesCompletas: blocoDatacoesCompletas,
};

function tituloDoNo(no) {
  if (no.tipo === "registro") return no.nome;
  if (no.tipo === "passagem") return no.referencia;
  return truncar(no.texto, 140);
}

function mostrarDetalhesNo(no) {
  const corpo = document.querySelector("#detalhes-corpo");
  const idx = indiceDoNo(no);
  const categoria = categoriaDoNo(no);
  const nomes = BLOCOS_POR_CATEGORIA[categoria] || ["descricao", "meta", "conexoes", "fontes"];

  corpo.innerHTML = `
    ${eyebrowNo(no)}
    <h2>${escapar(tituloDoNo(no))}</h2>
    ${no.alias?.length ? `<p class="etiqueta">${no.alias.map(escapar).join(" · ")}</p>` : ""}
    ${nomes.map((nome) => BLOCOS[nome](no, idx)).join("")}
    ${blocoCaminho(no)}
    ${blocoAcoes(no)}
  `;

  ligarAcoesDoPainel(corpo);
}

function rotuloPorId(id) {
  const no = noPorId(id);
  return no ? rotuloDoNo(no) : id;
}

function pontasDaAresta(aresta) {
  return [noPorId(aresta.origem), noPorId(aresta.destino)]
    .filter(Boolean)
    .map(
      (no) =>
        `<li class="conexao"><button class="ir-para-no" data-id="${no.id}" data-aresta="${
          aresta.id
        }"><span class="conexao-nome">${iconeInline(categoriaDoNo(no), corDoNo(no))}${escapar(
          truncar(rotuloDoNo(no), 34)
        )}</span></button></li>`
    )
    .join("");
}

function mostrarDetalhesAresta(aresta) {
  const corpo = document.querySelector("#detalhes-corpo");
  const pontas = `<ul class="conexoes">${pontasDaAresta(aresta)}</ul>`;

  // Arestas estruturais não têm força nem fonte — aparecem como contexto e
  // jamais com badge de evidência.
  if (ehEstrutural(aresta.tipo)) {
    const origem = escapar(rotuloPorId(aresta.origem));
    const destino = escapar(rotuloPorId(aresta.destino));
    const frase = {
      cita: `${origem} cita ${destino}.`,
      envolve: `${origem} é uma afirmação sobre ${destino}.`,
      parte_de: `${origem} é uma passagem de ${destino}.`,
    }[aresta.tipo];
    corpo.innerHTML = `
      ${eyebrow(cores.muted, { cita: "Cita", envolve: "Envolve", parte_de: "Parte de" }[aresta.tipo])}
      <p class="pills"><span class="pill pill-contexto">Estrutural — sem força de evidência</span></p>
      <p class="descricao">${frase}</p>
      ${pontas}`;
    ligarAcoesDoPainel(corpo);
    return;
  }

  const apoio = rotuloApoio(aresta.tipo_de_apoio);
  const sustentam = (aresta.quem_sustenta || []).map((q) => `<li>${escapar(q.nome)} (${q.ano})</li>`).join("");
  const fontes = (aresta.fontes || [])
    .map((f) => `<li ${marcaFonte(aresta)}><span class="nivel-fonte">nível ${f.nivel}</span>${htmlFonte(f)}</li>`)
    .join("");

  corpo.innerHTML = `
    ${eyebrow(cores.ouro, "Ligação")}
    <h2>${escapar(rotuloLigacao(aresta))}</h2>
    <p class="pills">
      <span class="pill ${classePill(aresta.forca)}">${escapar(rotuloForca(aresta.forca))}</span>
      ${apoio ? `<span class="pill pill-contexto">${escapar(apoio)}</span>` : ""}
    </p>
    ${pontas}
    ${sustentam ? secao("evidencia", "Quem sustenta", `<ul>${sustentam}</ul>`) : ""}
    ${fontes ? secao("fontes", "Fontes", `<ul>${fontes}</ul>`) : ""}
    ${blocoLimites([{ aresta, outro: null }])}
    <div class="acoes-card"><button class="abrir-dossie" data-id="${aresta.origem}">Ver ficha completa</button></div>
  `;
  ligarAcoesDoPainel(corpo);
}

// O card e o dossiê são redesenhados a cada seleção, então os listeners são
// religados a cada render — não há como delegar no container, que também é
// substituído.
function ligarAcoesDoPainel(raiz) {
  raiz.querySelectorAll(".ir-para-no").forEach((botao) => {
    botao.addEventListener("click", () => {
      fecharDossie();
      centralizarEm(botao.dataset.id, { viaAresta: botao.dataset.aresta || null });
    });
  });
  raiz.querySelectorAll(".abrir-dossie").forEach((botao) => {
    botao.addEventListener("click", () => abrirDossie(botao.dataset.id));
  });
  raiz.querySelectorAll(".abrir-leitura").forEach((botao) => {
    botao.addEventListener("click", () => {
      fecharDossie();
      abrirCapitulo(botao.dataset.texto);
    });
  });
  // Citação sem url própria: leva às fontes da ligação no mesmo painel —
  // abre o <details> se estiver fechado e pisca os itens por um instante.
  raiz.querySelectorAll(".citacao[data-ir-fonte]").forEach((link) => {
    link.addEventListener("click", (evento) => {
      evento.preventDefault();
      const itens = raiz.querySelectorAll(`[data-fonte-ligacao="${link.dataset.irFonte}"]`);
      if (itens.length === 0) return;
      itens.forEach((item) => {
        const detalhes = item.closest("details");
        if (detalhes) detalhes.open = true;
        item.classList.remove("fonte-destacada");
        void item.offsetWidth; // reinicia a animação num segundo clique
        item.classList.add("fonte-destacada");
      });
      itens[0].scrollIntoView({ block: "nearest", behavior: animacoesOk() ? "smooth" : "auto" });
    });
  });
}

function limparDetalhes() {
  document.querySelector("#detalhes-corpo").innerHTML =
    '<p class="vazio">Clique em um nó ou em uma ligação para ver os detalhes.</p>';
}

// --- Dossiê (nível 3) --------------------------------------------------------
// Overlay sobre o mapa, e não uma quarta aba: a ficha completa não deve custar
// o contexto do grafo. O estado vai no hash, para o link ser compartilhável.

let focoAntesDoDossie = null;
let dossieAberto = null;
let dossieConfigurado = false;

function montarDossie(no) {
  const idx = indiceDoNo(no);
  const categoria = categoriaDoNo(no);
  const oQueE = (no.descricao || no.texto || "").trim();

  // Fontes agrupadas por nível, cada uma creditada à ligação de onde vem.
  const porNivel = new Map();
  for (const f of idx.fontes) {
    if (!porNivel.has(f.nivel)) porNivel.set(f.nivel, []);
    porNivel.get(f.nivel).push(f);
  }
  const fontes = porNivel.size
    ? secao(
        "fontes",
        `Fontes (${idx.fontes.length})`,
        [...porNivel.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(
            ([nivel, fs]) =>
              `<h4>Nível ${nivel}</h4><ul>${fs
                .map(
                  (f) =>
                    `<li ${marcaFonte(f.aresta)}>${htmlFonte(f)}<span class="etiqueta">na ligação ${escapar(
                      rotuloLigacao(f.aresta)
                    )}</span></li>`
                )
                .join("")}</ul>`
          )
          .join("")
      )
    : "";

  const sustentam = idx.ligacoes.flatMap((c) =>
    (c.aresta.quem_sustenta || []).map(
      (q) =>
        `<li>${escapar(q.nome)} (${q.ano})<span class="etiqueta">${escapar(
          verboDaLigacao(c.aresta.tipo, c.saindo)
        )} ${escapar(rotuloDoNo(c.outro))}</span></li>`
    )
  );

  const conexoes = idx.conexoes.length
    ? secao(
        "conexoes",
        "Conexões e a natureza de cada uma",
        `<ul class="conexoes">${[...idx.ligacoes, ...idx.estruturais].map(itemConexao).join("")}</ul>`
      )
    : "";

  return `
    ${eyebrowNo(no)}
    <h2 id="dossie-titulo">${escapar(tituloDoNo(no))}</h2>
    ${no.alias?.length ? `<p class="etiqueta">${no.alias.map(escapar).join(" · ")}</p>` : ""}
    ${oQueE ? secao("evidencia", "O que é", `<p class="descricao">${comCitacoes(oQueE)}</p>`) : ""}
    ${categoria === "passagem" ? blocoAfirma(no) + blocoParalelo(no) : ""}
    ${blocoDatacoesCompletas(no, idx)}
    ${
      idx.lugares.length
        ? secao("local", "Lugares relacionados", `<ul>${idx.lugares.map((l) => `<li>${escapar(l.nome)}</li>`).join("")}</ul>`)
        : ""
    }
    ${blocoEvidencias(no, idx)}
    ${sustentam.length ? secao("evidencia", "Quem sustenta", `<ul>${sustentam.join("")}</ul>`) : ""}
    ${conexoes}
    ${fontes}
    ${blocoLimites(idx.limites)}
    ${blocoCaminho(no)}
  `;
}

function abrirDossie(id) {
  const no = noPorId(id);
  const painel = document.querySelector("#dossie");
  if (!no || !painel) return;

  focoAntesDoDossie = document.activeElement;
  const corpo = document.querySelector("#dossie-corpo");
  corpo.innerHTML = montarDossie(no);
  ligarAcoesDoPainel(corpo);
  painel.hidden = false;
  dossieAberto = id;
  // Nessa ordem: zerar o scroll so vale depois do painel ter layout, e o
  // focus precisa de preventScroll para nao arrastar a ficha ate o botao.
  corpo.scrollTop = 0;
  painel.querySelector(".fechar-dossie").focus({ preventScroll: true });

  if (lerIdDoHash() !== id) location.hash = `dossie=${encodeURIComponent(id)}`;
}

function fecharDossie({ limparHash = true } = {}) {
  const painel = document.querySelector("#dossie");
  if (!painel || painel.hidden) return;
  painel.hidden = true;
  dossieAberto = null;
  if (limparHash && lerIdDoHash()) {
    // replaceState em vez de location.hash = "": zerar o hash deixaria um "#"
    // preso na URL e um passo a mais no histórico do navegador.
    history.replaceState(null, "", location.pathname + location.search);
  }
  if (focoAntesDoDossie?.isConnected) focoAntesDoDossie.focus();
  focoAntesDoDossie = null;
}

function lerIdDoHash() {
  const achado = /^#dossie=(.+)$/.exec(location.hash);
  return achado ? decodeURIComponent(achado[1]) : null;
}

// Um link com #dossie=<id> abre direto na ficha completa daquele elemento.
function sincronizarDossieComHash() {
  const id = lerIdDoHash();
  if (id && id === dossieAberto) return;
  if (id && noPorId(id)) {
    mudarView("mapa");
    abrirDossie(id);
  } else {
    fecharDossie({ limparHash: false });
  }
}

function configurarDossie() {
  const painel = document.querySelector("#dossie");
  if (!painel || dossieConfigurado) return;
  dossieConfigurado = true;
  painel.querySelector(".fechar-dossie").addEventListener("click", () => fecharDossie());
  painel.addEventListener("click", (evento) => {
    if (evento.target === painel) fecharDossie();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") fecharDossie();
  });
  window.addEventListener("hashchange", sincronizarDossieComHash);
}

// --- Percurso por passagem ---------------------------------------------------

function montarPassagens() {
  const painel = document.querySelector("#view-passagens");
  const passagens = grafo.nos.filter((n) => n.tipo === "passagem").sort((a, b) => a.referencia.localeCompare(b.referencia));

  if (passagens.length === 0) return;

  const itens = passagens
    .map((p) => {
      const citacoes = grafo.arestas.filter((a) => a.origem === p.id && a.tipo === "cita").length;
      return `
        <li>
          <button class="ver-no-grafo" data-id="${p.id}">
            <strong>${escapar(p.titulo ? `${p.referencia} · ${p.titulo}` : p.referencia)}</strong>
            <span class="etiqueta">${plural(citacoes, "citação", "citações")}${p.nenhum_paralelo_conhecido ? " · nenhum paralelo externo conhecido" : ""}</span>
          </button>
          ${p.texto ? `<button class="abrir-leitura" data-texto="${escapar(p.texto)}">${iconeUI("leitura")}Ler o capítulo</button>` : ""}
        </li>
      `;
    })
    .join("");

  painel.innerHTML = `<ul class="lista-passagens">${itens}</ul>`;
  painel.querySelectorAll(".abrir-leitura").forEach((botao) => {
    botao.addEventListener("click", () => abrirCapitulo(botao.dataset.texto));
  });
  painel.querySelectorAll(".ver-no-grafo").forEach((botao) => {
    botao.addEventListener("click", () => {
      mudarView("mapa");
      centralizarEm(botao.dataset.id);
    });
  });
}

// --- Bíblia interativa ---------------------------------------------------------
// O capítulo lido como livro. As palavras que alguma nota comenta viram
// link (campo `trecho` nos dados); clicar abre um card flutuante junto da
// palavra. Tudo vem de docs/capitulos/<id>.json e do grafo.json: a tela não
// cria conteúdo, só organiza o que os dados trazem.

const TEMAS_LEITURA = {
  traducao: {
    rotulo: "Tradução discutida",
    icone: "traducao",
    cor: "var(--teal)",
    explica: "O hebraico admite mais de uma tradução.",
  },
  variante: {
    rotulo: "Variante textual",
    icone: "variante",
    cor: "var(--violeta)",
    explica: "Manuscritos e versões antigas trazem um texto diferente.",
  },
  paralelo: {
    rotulo: "Paralelo em outra cultura",
    icone: "paralelo",
    cor: "var(--ouro)",
    explica: "Relato de outro povo com uma imagem parecida.",
  },
  ciencia: {
    rotulo: "O que a ciência diz",
    icone: "ciencia",
    cor: "var(--cor-lugar)",
    explica: "Medições científicas sobre o tema do versículo.",
  },
  leitura_literal: {
    rotulo: "Leitura literal",
    icone: "leitura",
    cor: "var(--cor-pessoa)",
    explica: "Tradições que leem o texto ao pé da letra.",
  },
  leitura_nao_literal: {
    rotulo: "Leitura não literal",
    icone: "leitura",
    cor: "var(--rosa)",
    explica: "Tradições que leem o texto como simbólico ou teológico.",
  },
  contexto: { rotulo: "Contexto", icone: "conexoes", cor: "var(--muted)", explica: "Informação de contexto." },
};

// Quantos capítulos cada livro tem, para a grade de navegação. O de Gênesis
// está na descrição do próprio registro ("Em 50 capítulos…"); os capítulos
// sem texto cadastrado aparecem, mas desabilitados.
const CAPITULOS_POR_LIVRO = { Gênesis: 50 };

let indiceCapitulos = [];
let capituloAberto = null; // { dados, itens }
const temasOcultosLeitura = new Set();
let notaAberta = null; // { ids, indice, ancora }

const ehLeituraMovel = () => window.matchMedia("(max-width: 860px)").matches;
const temaDe = (item) => TEMAS_LEITURA[item.tema] || TEMAS_LEITURA.contexto;

async function carregarIndiceCapitulos() {
  indiceCapitulos = (await carregarJSON("capitulos/indice.json")) || [];
}

function lerCapituloDoHash() {
  const achado = /^#capitulo=(.+)$/.exec(location.hash);
  return achado ? decodeURIComponent(achado[1]) : null;
}

function referenciaVersiculos(capitulo, [inicio, fim]) {
  const trecho = inicio === fim ? `${inicio}` : `${inicio}–${fim}`;
  return `${capitulo.livro} ${capitulo.capitulo}:${trecho}`;
}

// Notas e conexões num formato só, na ordem do texto. Uma conexão cuja
// ligação não está no grafo (dado inconsistente) é descartada, não inventada.
function itensDoCapitulo(capitulo) {
  const notas = capitulo.notas.map((nota) => ({
    id: nota.id,
    tema: nota.tipo,
    versiculos: nota.versiculos,
    trecho: nota.trecho || null,
    titulo: nota.titulo,
    corpo: nota.descricao,
    sobre: null,
    leituras: nota.leituras || [],
    fontes: nota.fontes || [],
    aresta: null,
  }));
  const conexoes = capitulo.conexoes
    .map((conexao) => {
      const aresta = grafo.arestas.find((a) => a.ligacao === conexao.ligacao);
      if (!aresta) return null;
      const sujeito = noPorId(aresta.origem);
      const alvo = noPorId(aresta.destino);
      // No card, o título vai inteiro: "13,8 bil…" cortado não serve para ler.
      const nomeInteiro = (no) =>
        no?.tipo === "afirmacao" ? `“${no.texto.trim().replace(/\.$/, "")}”` : no ? rotuloDoNo(no) : "";
      return {
        id: conexao.ligacao,
        tema: conexao.tema,
        versiculos: conexao.versiculos,
        trecho: conexao.trecho || null,
        titulo: `${nomeInteiro(sujeito)} ${verboDaLigacao(aresta.tipo)} ${nomeInteiro(alvo)}`,
        // A explicação da ligação diz por que ela importa para o capítulo;
        // a descrição do registro entra à parte, como "Sobre".
        corpo: aresta.notas || sujeito?.descricao || "",
        sobre: sujeito?.tipo === "registro" && aresta.notas ? { nome: sujeito.nome, descricao: sujeito.descricao } : null,
        leituras: [],
        fontes: aresta.fontes || [],
        aresta,
      };
    })
    .filter(Boolean);
  // Ordem de leitura: versículo, depois a posição do trecho dentro dele
  // (notas sem trecho, que viram ícone no fim do versículo, vêm por último).
  const posicao = (item) => {
    const texto = capitulo.versiculos.find((v) => v.n === item.versiculos[0])?.texto || "";
    const i = item.trecho ? texto.indexOf(item.trecho) : -1;
    return i < 0 ? Infinity : i;
  };
  return [...notas, ...conexoes].sort(
    (a, b) => a.versiculos[0] - b.versiculos[0] || posicao(a) - posicao(b) || a.versiculos[1] - b.versiculos[1]
  );
}

// Quem rola a página é o <main> (overflow: auto), não a janela.
const areaDeRolagem = () => document.querySelector("main") || document.scrollingElement;

// Datações do livro (tradição × pesquisa): as afirmações que envolvem o
// registro do livro, as mesmas que o card do livro mostra no mapa.
function datacoesDoLivro(nomeDoLivro) {
  const livro = grafo.nos.find((n) => n.tipo === "registro" && n.nome === nomeDoLivro);
  if (!livro) return [];
  return grafo.arestas
    .filter((a) => a.tipo === "envolve" && a.destino === livro.id)
    .map((a) => noPorId(a.origem))
    .filter(Boolean)
    .flatMap((afirmacao) => (afirmacao.datacao || []).map((d) => ({ ...d, afirmacao })))
    .sort((a, b) => a.periodo[0] - b.periodo[0]);
}

// --- Montagem da página ------------------------------------------------------

function htmlLateral(capitulo, itens) {
  const total = CAPITULOS_POR_LIVRO[capitulo.livro] || capitulo.capitulo;
  const disponiveis = new Map(
    indiceCapitulos.filter((c) => c.livro === capitulo.livro).map((c) => [c.capitulo, c.id])
  );
  const grade = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    const id = disponiveis.get(n);
    const atual = n === capitulo.capitulo;
    return id
      ? `<button class="cap${atual ? " atual" : ""}" data-capitulo="${escapar(id)}"${atual ? ' aria-current="page"' : ""} title="${escapar(
          `${capitulo.livro} ${n}`
        )}">${n}</button>`
      : `<button class="cap" disabled title="${escapar(`${capitulo.livro} ${n}: ainda não cadastrado`)}">${n}</button>`;
  }).join("");

  const temas = Object.keys(TEMAS_LEITURA).filter((tema) => itens.some((i) => i.tema === tema));
  const legenda = temas
    .map((tema) => {
      const t = TEMAS_LEITURA[tema];
      const quantos = itens.filter((i) => i.tema === tema).length;
      const visivel = !temasOcultosLeitura.has(tema);
      return `
        <li style="--cor-tema: ${t.cor}">
          <button class="legenda-tema${visivel ? "" : " apagado"}" data-tema="${tema}" aria-pressed="${visivel}" title="${
            visivel ? "Esconder" : "Mostrar"
          } as notas deste tipo">
            <span class="legenda-icone">${iconeUI(t.icone)}</span>
            <span class="legenda-texto"><strong>${escapar(t.rotulo)}</strong><span>${escapar(t.explica)}</span></span>
            <span class="legenda-contagem">${quantos}</span>
          </button>
        </li>`;
    })
    .join("");

  const datacoes = datacoesDoLivro(capitulo.livro);
  const quando = datacoes.length
    ? `<section class="lateral-bloco">
        <h3>${iconeUI("datacao")}Quando foi escrito</h3>
        <ul class="lateral-datacoes">${datacoes
          .map((d) => {
            const [inicio, resto] = primeiraFrase(d.segundo_quem.trim());
            return `<li><strong>${escapar(formatarPeriodo(d.periodo))}</strong><span>${comCitacoes(inicio)}</span>${
              resto ? `<details class="mais"><summary>Continuar lendo</summary><p>${comCitacoes(resto)}</p></details>` : ""
            }</li>`;
          })
          .join("")}</ul>
      </section>`
    : "";

  return `
    <aside class="biblia-lateral" aria-label="Navegação e legenda">
      <section class="lateral-bloco">
        <h3>${iconeUI("leitura")}${escapar(capitulo.livro)}</h3>
        <nav class="grade-capitulos" aria-label="Capítulos de ${escapar(capitulo.livro)}">${grade}</nav>
      </section>
      ${
        personagensDoCapitulo(capitulo).length
          ? `<section class="lateral-bloco"><h3>${iconeInline("pessoa", corDaCategoria("pessoa"))}Personagens</h3>${htmlChipsPersonagens(capitulo)}<p class="lateral-dica">Passe o mouse para ver onde aparecem; clique para a ficha técnica.</p></section>`
          : ""
      }
      <section class="lateral-bloco">
        <h3>${iconeUI("evidencia")}Legenda</h3>
        <p class="lateral-dica">As palavras sublinhadas no texto abrem uma nota. Toque num tipo para mostrá-lo ou escondê-lo.</p>
        <ul class="legenda-leitura">${legenda}</ul>
      </section>
      ${quando}
    </aside>`;
}

function htmlCabecalho(capitulo, itens) {
  const { passagem } = capitulo;
  return `
    <header class="biblia-cabecalho">
      <p class="leitura-eyebrow">${escapar(passagem.referencia)} · ${plural(itens.length, "nota", "notas")}</p>
      <h2 class="leitura-titulo">${escapar(passagem.titulo || passagem.referencia)}</h2>
      <div class="leitura-resumo">${passagem.afirma.map((frase) => `<p>${comCitacoes(frase)}</p>`).join("")}</div>
      ${htmlChipsPersonagens(capitulo)}
    </header>`;
}

// Cada versículo vira texto com links nos trechos comentados. Trechos iguais
// no mesmo versículo viram um link só, que abre as notas juntas; notas sem
// trecho viram um ícone no fim do versículo.
function htmlTexto(capitulo, itens) {
  const porVersiculo = new Map();
  for (const item of itens) {
    const v = item.versiculos[0];
    if (!porVersiculo.has(v)) porVersiculo.set(v, []);
    porVersiculo.get(v).push(item);
  }

  const versiculos = capitulo.versiculos
    .map((v) => {
      const doVersiculo = porVersiculo.get(v.n) || [];
      const grupos = new Map();
      const soltos = [];
      for (const item of doVersiculo) {
        const indice = item.trecho ? v.texto.indexOf(item.trecho) : -1;
        if (indice < 0) {
          soltos.push(item);
          continue;
        }
        if (!grupos.has(item.trecho)) grupos.set(item.trecho, { inicio: indice, fim: indice + item.trecho.length, itens: [] });
        grupos.get(item.trecho).itens.push(item);
      }
      // Trechos que se sobrepõem: o primeiro fica como link, os outros
      // voltam a ser ícone (melhor do que um link dentro do outro).
      const ordenados = [...grupos.values()].sort((a, b) => a.inicio - b.inicio);
      const aceitos = [];
      for (const g of ordenados) {
        if (aceitos.length && g.inicio < aceitos[aceitos.length - 1].fim) soltos.push(...g.itens);
        else aceitos.push(g);
      }

      let html = "";
      let cursor = 0;
      for (const g of aceitos) {
        html += escapar(v.texto.slice(cursor, g.inicio));
        const primeiro = g.itens[0];
        const temas = [...new Set(g.itens.map((i) => i.tema))];
        const rotulo =
          g.itens.length === 1
            ? `${temaDe(primeiro).rotulo}: ${primeiro.titulo}`
            : `${plural(g.itens.length, "nota", "notas")} sobre este trecho`;
        html += `<a href="#" class="termo" role="button" aria-haspopup="dialog" data-itens="${escapar(
          g.itens.map((i) => i.id).join(" ")
        )}" data-temas="${temas.join(" ")}" style="--cor-tema: ${temaDe(primeiro).cor}" title="${escapar(rotulo)}">${escapar(
          v.texto.slice(g.inicio, g.fim)
        )}<span class="termo-icone" aria-hidden="true">${iconeUI(temaDe(primeiro).icone)}${
          g.itens.length > 1 ? `<span class="termo-contagem">${g.itens.length}</span>` : ""
        }</span></a>`;
        cursor = g.fim;
      }
      html += escapar(v.texto.slice(cursor));

      const marcas = soltos
        .map(
          (item) =>
            `<button class="marca-nota" data-itens="${escapar(item.id)}" data-temas="${item.tema}" style="--cor-tema: ${
              temaDe(item).cor
            }" aria-haspopup="dialog" aria-label="${escapar(`${temaDe(item).rotulo}: ${item.titulo}`)}" title="${escapar(
              `${temaDe(item).rotulo}: ${item.titulo}`
            )}">${iconeUI(temaDe(item).icone)}</button>`
        )
        .join("");

      return `<span class="versiculo" id="v-${v.n}" data-v="${v.n}"><sup class="num-versiculo">${v.n}</sup>${html}${marcas}</span> `;
    })
    .join("");
  return `<div class="leitura-texto" lang="pt-BR"><p>${versiculos}</p></div>`;
}

function htmlIndice(capitulo, itens) {
  const porTema = Object.keys(TEMAS_LEITURA)
    .map((tema) => [tema, itens.filter((i) => i.tema === tema)])
    .filter(([, lista]) => lista.length);
  return `
    <aside class="biblia-indice" aria-label="Notas deste capítulo">
      <h3>Neste capítulo</h3>
      ${porTema
        .map(
          ([tema, lista]) => `
        <section class="indice-grupo" data-tema="${tema}" style="--cor-tema: ${TEMAS_LEITURA[tema].cor}">
          <h4>${iconeUI(TEMAS_LEITURA[tema].icone)}${escapar(TEMAS_LEITURA[tema].rotulo)}</h4>
          <ul>${lista
            .map(
              (item) => `<li><button class="indice-item" data-itens="${escapar(item.id)}" data-v="${item.versiculos[0]}">
                <span class="indice-ref">${escapar(referenciaVersiculos(capitulo, item.versiculos).replace(/^.* /, ""))}</span>
                <span>${escapar(item.titulo)}</span></button></li>`
            )
            .join("")}</ul>
        </section>`
        )
        .join("")}
    </aside>`;
}

function htmlCardDeItem(item) {
  const tema = temaDe(item);
  const forca = item.aresta?.forca
    ? `<span class="pill ${classePill(item.aresta.forca)}" title="Força do apoio">${escapar(rotuloForca(item.aresta.forca))}</span>`
    : "";
  return `
    <article class="card-leitura" data-item="${escapar(item.id)}" style="--cor-tema: ${tema.cor}">
      <p class="card-leitura-tipo">${iconeUI(tema.icone)}${escapar(tema.rotulo)}<span class="etiqueta">${escapar(
        referenciaVersiculos(capituloAberto.dados, item.versiculos)
      )}</span></p>
      <h3 id="nota-titulo">${escapar(item.titulo)}</h3>
      ${forca}
      <p class="card-leitura-corpo">${comCitacoes(item.corpo || "", item.aresta)}</p>
      ${item.sobre ? `<p class="card-leitura-notas"><strong>Sobre ${escapar(item.sobre.nome)}:</strong> ${escapar(item.sobre.descricao)}</p>` : ""}
      ${
        item.leituras.length
          ? `<ul class="card-leitura-leituras">${item.leituras
              .map((l) => `<li><strong>${escapar(l.leitura)}</strong><span>${escapar(l.quem)}</span></li>`)
              .join("")}</ul>`
          : ""
      }
      ${
        item.fontes.length
          ? `<details class="mais"><summary>${plural(item.fontes.length, "fonte", "fontes")}</summary><ul class="card-leitura-fontes">${item.fontes
              .map((f) => `<li><span class="nivel-fonte">nível ${f.nivel}</span>${htmlFonte(f)}</li>`)
              .join("")}</ul></details>`
          : ""
      }
      ${
        item.aresta
          ? `<button class="card-leitura-mapa" data-id="${escapar(item.aresta.origem)}">${iconeUI("conexoes")}Ver no mapa</button>`
          : ""
      }
    </article>`;
}

// Anterior e seguinte, na ordem do índice; o que ainda não existe some.
function htmlNavCapitulos(capitulo) {
  const i = indiceCapitulos.findIndex((c) => c.id === capitulo.id);
  const anterior = indiceCapitulos[i - 1];
  const seguinte = indiceCapitulos[i + 1];
  if (!anterior && !seguinte) return "";
  const botao = (c, lado) =>
    c
      ? `<button class="nav-capitulo ${lado}" data-capitulo="${escapar(c.id)}"><span class="etiqueta">${
          lado === "anterior" ? "← Capítulo anterior" : "Próximo capítulo →"
        }</span><strong>${escapar(`${c.livro} ${c.capitulo}`)}${c.titulo ? ` · ${escapar(c.titulo)}` : ""}</strong></button>`
      : "<span></span>";
  return `<nav class="navegacao-capitulos" aria-label="Capítulos vizinhos">${botao(anterior, "anterior")}${botao(seguinte, "seguinte")}</nav>`;
}

function htmlCreditos(capitulo) {
  const t = capitulo.traducao;
  const licenca = urlSegura(t.licenca_url);
  const fonte = urlSegura(t.fonte);
  return `
    <footer class="leitura-creditos">
      <p><strong>Texto bíblico:</strong> ${escapar(t.nome)} (${escapar(t.sigla)}). ${escapar(t.atribuicao)}</p>
      <p>${fonte ? `<a href="${escapar(fonte)}" target="_blank" rel="noopener noreferrer">Arquivo de origem${ICONE_EXTERNO}</a>` : ""}${
        licenca ? ` · <a href="${escapar(licenca)}" target="_blank" rel="noopener noreferrer">Licença (${escapar(t.licenca)})${ICONE_EXTERNO}</a>` : ""
      }</p>
      <p class="etiqueta">O texto aparece como na fonte, dividido em versículos. Títulos, resumos, destaques e notas são do Tudo Conectado, não da tradução.</p>
    </footer>`;
}

async function abrirCapitulo(id, { atualizarHash = true } = {}) {
  const painel = document.querySelector("#view-leitura");
  if (!painel) return;
  const dados = await carregarJSON(`capitulos/${encodeURIComponent(id)}.json`);
  if (!dados) {
    painel.innerHTML = `<div class="estado-vazio"><p>Capítulo não encontrado.</p></div>`;
    mudarView("leitura");
    return;
  }
  fecharNota({ devolverFoco: false });
  personagemAberto = null;
  capituloAberto = { dados, itens: itensDoCapitulo(dados) };
  const { itens } = capituloAberto;

  painel.innerHTML = `
    <div class="biblia">
      ${htmlLateral(dados, itens)}
      <article class="biblia-leitura">
        <div class="biblia-progresso" aria-hidden="true"><span></span></div>
        ${htmlCabecalho(dados, itens)}
        ${htmlTexto(dados, itens)}
        ${htmlNavCapitulos(dados)}
        ${htmlCreditos(dados)}
      </article>
      ${htmlIndice(dados, itens)}
    </div>
    <div class="nota-flutuante" hidden role="dialog" aria-modal="false" aria-labelledby="nota-titulo">
      <span class="nota-seta" aria-hidden="true"></span>
      <div class="nota-barra">
        <span class="nota-pager"></span>
        <button class="nota-anterior" aria-label="Nota anterior">‹</button>
        <button class="nota-seguinte" aria-label="Próxima nota">›</button>
        <button class="nota-fechar" aria-label="Fechar nota">
          <svg viewBox="0 0 24 24" class="icone"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </button>
      </div>
      <div class="nota-corpo"></div>
    </div>
    <aside class="ficha-personagem" hidden role="dialog" aria-modal="false" aria-labelledby="ficha-titulo">
      <button class="ficha-fechar" aria-label="Fechar ficha">
        <svg viewBox="0 0 24 24" class="icone"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </button>
      <div class="ficha-corpo"></div>
    </aside>`;

  aplicarTemasOcultosLeitura();
  ligarBiblia(painel);
  mudarView("leitura");
  if (atualizarHash && lerCapituloDoHash() !== id) history.pushState(null, "", `#capitulo=${encodeURIComponent(id)}`);
  areaDeRolagem().scrollTo({ top: 0 });
  acompanharLeitura();
}

// --- Interação ------------------------------------------------------------------

function aplicarTemasOcultosLeitura() {
  const raiz = document.querySelector(".biblia");
  if (!raiz) return;
  raiz.querySelectorAll("[data-temas]").forEach((el) => {
    const temas = el.dataset.temas.split(" ");
    el.classList.toggle("tema-oculto", temas.every((t) => temasOcultosLeitura.has(t)));
  });
  raiz.querySelectorAll(".indice-grupo").forEach((g) => (g.hidden = temasOcultosLeitura.has(g.dataset.tema)));
  raiz.querySelectorAll(".legenda-tema").forEach((b) => {
    const visivel = !temasOcultosLeitura.has(b.dataset.tema);
    b.classList.toggle("apagado", !visivel);
    b.setAttribute("aria-pressed", String(visivel));
  });
}

function realcarVersiculos(ids, ligado) {
  for (const id of ids) {
    const item = capituloAberto?.itens.find((i) => i.id === id);
    if (!item) continue;
    for (let v = item.versiculos[0]; v <= item.versiculos[1]; v++) {
      document.querySelector(`#v-${v}`)?.classList.toggle("realcado", ligado);
    }
  }
}

// Ordem de navegação com ← e →: todas as notas visíveis, na ordem do texto.
function idsNavegaveis() {
  return capituloAberto.itens.filter((i) => !temasOcultosLeitura.has(i.tema)).map((i) => i.id);
}

function ancoraDoItem(id) {
  return [...document.querySelectorAll(".biblia-leitura [data-itens]")].find((el) => el.dataset.itens.split(" ").includes(id));
}

function abrirNota(ids, ancora, indice = 0) {
  if (!capituloAberto || !ids.length) return;
  const pop = document.querySelector(".nota-flutuante");
  if (notaAberta?.ancora && notaAberta.ancora !== ancora) {
    notaAberta.ancora.classList.remove("ativo");
    realcarVersiculos(notaAberta.ids, false);
  }
  notaAberta = { ids, indice, ancora };
  const item = capituloAberto.itens.find((i) => i.id === ids[indice]);
  pop.querySelector(".nota-corpo").innerHTML = htmlCardDeItem(item);
  pop.querySelector(".nota-pager").textContent = ids.length > 1 ? `${indice + 1} de ${ids.length} neste trecho` : "";
  pop.style.setProperty("--cor-tema", temaDe(item).cor);
  ligarCardFlutuante(pop);

  ancora?.classList.add("ativo");
  realcarVersiculos(ids, true);
  document.querySelectorAll(".indice-item").forEach((b) => b.classList.toggle("ativo", ids.includes(b.dataset.itens)));

  const reabrindo = !pop.hidden;
  pop.hidden = false;
  pop.classList.toggle("folha", ehLeituraMovel());
  posicionarNota();
  if (!reabrindo) {
    pop.classList.remove("entrando");
    void pop.offsetWidth; // reinicia a animação de entrada
    pop.classList.add("entrando");
  }
  pop.querySelector(".nota-fechar").focus({ preventScroll: true });
}

// Card junto da palavra: abaixo dela se couber, senão acima; nunca fora da
// tela. No celular vira folha inferior (o CSS cuida da posição).
function posicionarNota() {
  const pop = document.querySelector(".nota-flutuante");
  if (!pop || pop.hidden || !notaAberta?.ancora) return;
  if (ehLeituraMovel()) {
    pop.style.left = pop.style.top = "";
    return;
  }
  const r = notaAberta.ancora.getBoundingClientRect();
  // A palavra saiu da tela na rolagem: o card não fica solto na borda.
  if (r.bottom < 0 || r.top > window.innerHeight) {
    fecharNota({ devolverFoco: false });
    return;
  }
  const margem = 12;
  // Espaço útil: da borda de baixo da tela até a de cima da área de leitura
  // (o cabeçalho do site fica fora). Se o card não couber inteiro em nenhum
  // lado, vai para o maior e rola por dentro.
  const limiteDeCima = areaDeRolagem().getBoundingClientRect().top + margem;
  const espacoAbaixo = window.innerHeight - r.bottom - 10 - margem;
  const espacoAcima = r.top - 10 - limiteDeCima;
  pop.style.maxHeight = "";
  const alturaNatural = pop.offsetHeight;
  const cabeAbaixo = alturaNatural <= espacoAbaixo || espacoAbaixo >= espacoAcima;
  const espaco = cabeAbaixo ? espacoAbaixo : espacoAcima;
  if (alturaNatural > espaco) pop.style.maxHeight = `${Math.max(espaco, 160)}px`;
  const largura = pop.offsetWidth;
  const altura = pop.offsetHeight;
  const esquerda = Math.min(Math.max(margem, r.left + r.width / 2 - largura / 2), window.innerWidth - largura - margem);
  const topo = cabeAbaixo ? r.bottom + 10 : Math.max(limiteDeCima, r.top - altura - 10);
  // Posição fixa na tela: ao rolar, posicionarNota() acompanha a palavra.
  pop.style.left = `${esquerda}px`;
  pop.style.top = `${topo}px`;
  pop.classList.toggle("acima", !cabeAbaixo);
  pop.style.setProperty("--seta-x", `${Math.min(Math.max(16, r.left + r.width / 2 - esquerda), largura - 16)}px`);
}

function fecharNota({ devolverFoco = true } = {}) {
  const pop = document.querySelector(".nota-flutuante");
  if (!pop || pop.hidden) return;
  pop.hidden = true;
  if (notaAberta) {
    notaAberta.ancora?.classList.remove("ativo");
    realcarVersiculos(notaAberta.ids, false);
    if (devolverFoco) notaAberta.ancora?.focus({ preventScroll: true });
  }
  document.querySelectorAll(".indice-item.ativo").forEach((b) => b.classList.remove("ativo"));
  notaAberta = null;
}

// Vai para a nota vizinha na ordem do texto (setas ← → ou botões ‹ ›).
function navegarNota(passo) {
  if (!notaAberta) return;
  const { ids, indice } = notaAberta;
  if (ids.length > 1 && indice + passo >= 0 && indice + passo < ids.length) {
    abrirNota(ids, notaAberta.ancora, indice + passo);
    return;
  }
  const ordem = idsNavegaveis();
  const atual = ordem.indexOf(ids[indice]);
  const proximo = ordem[atual + passo];
  if (!proximo) return;
  const ancora = ancoraDoItem(proximo);
  const grupo = ancora ? ancora.dataset.itens.split(" ") : [proximo];
  ancora?.scrollIntoView({ block: "center", behavior: animacoesOk() ? "smooth" : "auto" });
  setTimeout(() => abrirNota(grupo, ancora, grupo.indexOf(proximo)), animacoesOk() ? 250 : 0);
}

function ligarCardFlutuante(pop) {
  pop.querySelectorAll(".card-leitura-mapa").forEach((botao) =>
    botao.addEventListener("click", () => {
      fecharNota({ devolverFoco: false });
      history.pushState(null, "", location.pathname);
      mudarView("mapa");
      centralizarEm(botao.dataset.id);
    })
  );
  pop.querySelectorAll("details").forEach((d) => d.addEventListener("toggle", posicionarNota));
}

function ligarBiblia(raiz) {
  raiz.querySelectorAll(".biblia-leitura [data-itens]").forEach((el) => {
    const ids = el.dataset.itens.split(" ");
    el.addEventListener("click", (evento) => {
      evento.preventDefault();
      evento.stopPropagation();
      if (notaAberta?.ancora === el) fecharNota();
      else abrirNota(ids, el);
    });
    el.addEventListener("mouseenter", () => realcarVersiculos(ids, true));
    el.addEventListener("mouseleave", () => {
      if (notaAberta?.ancora !== el) realcarVersiculos(ids, false);
    });
  });
  raiz.querySelectorAll(".indice-item").forEach((botao) =>
    botao.addEventListener("click", (evento) => {
      evento.stopPropagation();
      const id = botao.dataset.itens;
      const ancora = ancoraDoItem(id);
      const grupo = ancora ? ancora.dataset.itens.split(" ") : [id];
      ancora?.scrollIntoView({ block: "center", behavior: animacoesOk() ? "smooth" : "auto" });
      setTimeout(() => abrirNota(grupo, ancora, grupo.indexOf(id)), animacoesOk() ? 300 : 0);
    })
  );
  raiz.querySelectorAll(".legenda-tema").forEach((botao) =>
    botao.addEventListener("click", () => {
      const tema = botao.dataset.tema;
      if (temasOcultosLeitura.has(tema)) temasOcultosLeitura.delete(tema);
      else temasOcultosLeitura.add(tema);
      fecharNota({ devolverFoco: false });
      aplicarTemasOcultosLeitura();
    })
  );
  raiz.querySelectorAll(".cap[data-capitulo], .nav-capitulo").forEach((botao) =>
    botao.addEventListener("click", () => abrirCapitulo(botao.dataset.capitulo))
  );
  raiz.querySelectorAll(".lateral-bloco details").forEach((d) => d.addEventListener("toggle", posicionarNota));

  const pop = raiz.querySelector(".nota-flutuante");
  pop.querySelector(".nota-fechar").addEventListener("click", () => fecharNota());
  pop.querySelector(".nota-anterior").addEventListener("click", () => navegarNota(-1));
  pop.querySelector(".nota-seguinte").addEventListener("click", () => navegarNota(1));
  pop.addEventListener("click", (evento) => evento.stopPropagation());
  ligarPersonagens(raiz);
}

// Índice que acompanha a leitura: as notas dos versículos que estão na faixa
// central da tela acendem. Com um capítulo de ~30 versículos, medir as
// posições a cada quadro de rolagem é barato e não depende de quando o
// navegador entrega eventos de interseção.
let quadroPendente = false;
function acompanharLeitura() {
  if (quadroPendente) return;
  quadroPendente = true;
  requestAnimationFrame(() => {
    quadroPendente = false;
    const topo = window.innerHeight * 0.15;
    const fundo = window.innerHeight * 0.65;
    const naTela = new Set();
    document.querySelectorAll(".leitura-texto .versiculo").forEach((v) => {
      const r = v.getBoundingClientRect();
      if (r.bottom > topo && r.top < fundo) naTela.add(Number(v.dataset.v));
    });
    document.querySelectorAll(".indice-item").forEach((b) => b.classList.toggle("na-tela", naTela.has(Number(b.dataset.v))));
    atualizarProgresso();
  });
}

function atualizarProgresso() {
  const texto = document.querySelector(".leitura-texto");
  const barra = document.querySelector(".biblia-progresso span");
  if (!texto || !barra || document.querySelector("#view-leitura").hidden) return;
  const r = texto.getBoundingClientRect();
  const total = r.height - window.innerHeight * 0.5;
  const lido = Math.min(Math.max((window.innerHeight * 0.5 - r.top) / Math.max(total, 1), 0), 1);
  barra.style.transform = `scaleX(${lido})`;
}

function configurarBiblia() {
  document.addEventListener("click", (evento) => {
    const pop = document.querySelector(".nota-flutuante");
    if (pop && !pop.hidden && !pop.contains(evento.target)) fecharNota({ devolverFoco: false });
  });
  document.addEventListener("keydown", (evento) => {
    if (!notaAberta) {
      if (evento.key === "Escape" && personagemAberto) fecharPersonagem();
      return;
    }
    if (evento.key === "Escape") fecharNota();
    else if (evento.key === "ArrowRight") navegarNota(1);
    else if (evento.key === "ArrowLeft") navegarNota(-1);
  });
  areaDeRolagem().addEventListener(
    "scroll",
    () => {
      acompanharLeitura();
      posicionarNota();
    },
    { passive: true }
  );
  window.addEventListener("resize", () => {
    atualizarProgresso();
    posicionarNota();
  });
}

// --- Personagens do capítulo ------------------------------------------------------
// Os personagens são os registros tipo=pessoa que a passagem cita
// (registros_citados). Cada um tem uma ficha técnica derivada do grafo:
// descrição, datações, conexões e os objetos historicamente comprovados.

// "Comprovado historicamente": objeto ligado por evidência material
// (achado arqueológico ou inscrição) com força forte. O critério aparece na
// própria ficha, para o leitor saber o que entrou e o que ficou de fora.
const APOIO_MATERIAL = new Set(["achado_arqueologico", "inscricao"]);
const FORCA_COMPROVADA = new Set(["bem_estabelecido", "aceito_maioria"]);

let personagemAberto = null;

function personagensDoCapitulo(capitulo) {
  return grafo.arestas
    .filter((a) => a.tipo === "cita" && a.origem === capitulo.passagem.id)
    .map((a) => noPorId(a.destino))
    .filter((no) => no?.tipo === "registro" && no.subtipo === "pessoa");
}

// Versículos em que o personagem aparece: o nome ou um dos outros nomes,
// como palavra inteira, sem diferenciar maiúsculas.
function versiculosDoPersonagem(capitulo, pessoa) {
  const nomes = [pessoa.nome, ...(pessoa.alias || [])].filter(Boolean);
  const padroes = nomes.map((n) => new RegExp(`(^|[^\\p{L}])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\// A aba Passagens é a Bíblia: abre o capítulo em leitura (ou o primeiro).")}(?=$|[^\\p{L}])`, "iu"));
  return capitulo.versiculos.filter((v) => padroes.some((p) => p.test(v.texto))).map((v) => v.n);
}

// Vizinhos no grafo, pelo caminho que importa para a ficha: ligações com
// evidência e as afirmações sobre o personagem (e, através delas, quem as
// confirma ou contradiz).
function conexoesDoPersonagem(pessoa) {
  const vizinhos = new Map();
  const juntar = (no, aresta, via = null) => {
    if (!no || no.id === pessoa.id || vizinhos.has(no.id)) return;
    vizinhos.set(no.id, { no, aresta, via });
  };
  for (const a of grafo.arestas) {
    if (a.origem !== pessoa.id && a.destino !== pessoa.id) continue;
    if (a.tipo === "cita") continue;
    const outro = noPorId(a.origem === pessoa.id ? a.destino : a.origem);
    juntar(outro, a);
    if (outro?.tipo === "afirmacao") {
      for (const b of grafo.arestas) {
        if (!b.forca || (b.origem !== outro.id && b.destino !== outro.id)) continue;
        juntar(noPorId(b.origem === outro.id ? b.destino : b.origem), b, outro);
      }
    }
  }
  return [...vizinhos.values()];
}

function objetosComprovados(pessoa) {
  return conexoesDoPersonagem(pessoa).filter(
    ({ no, aresta }) =>
      no.subtipo === "objeto" && APOIO_MATERIAL.has(aresta.tipo_de_apoio) && FORCA_COMPROVADA.has(aresta.forca)
  );
}

// Mini-grafo radial: o personagem no centro, os vizinhos em volta. É SVG
// puro (sem o Cytoscape), porque cabe em 300px e não precisa de física.
function htmlMiniGrafo(pessoa, conexoes) {
  if (conexoes.length === 0) return `<p class="ficha-vazio">Nenhuma conexão registrada ainda.</p>`;
  const largura = 320;
  const altura = 240;
  const cx = largura / 2;
  const cy_ = altura / 2;
  const raio = 88;
  const itens = conexoes.slice(0, 10);
  const pontos = itens.map((c, i) => {
    const angulo = -Math.PI / 2 + (2 * Math.PI * i) / itens.length;
    return { ...c, x: cx + raio * Math.cos(angulo), y: cy_ + raio * Math.sin(angulo) };
  });
  const linhas = pontos
    .map(
      (p) =>
        `<line x1="${cx}" y1="${cy_}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" class="mini-linha${
          p.aresta.forca ? "" : " estrutural"
        }" />`
    )
    .join("");
  const nos = pontos
    .map((p) => {
      const categoria = categoriaDoNo(p.no);
      const rotulo = truncar(rotuloDoNo(p.no), 18);
      const abaixo = p.y >= cy_;
      return `<g class="mini-no" role="button" tabindex="0" data-id="${escapar(p.no.id)}" aria-label="${escapar(
        rotuloDoNo(p.no)
      )}">
        <title>${escapar(rotuloDoNo(p.no))}</title>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="11" style="stroke: ${corDaCategoria(categoria)}" />
        <text x="${p.x.toFixed(1)}" y="${(p.y + (abaixo ? 26 : -17)).toFixed(1)}" text-anchor="middle">${escapar(rotulo)}</text>
      </g>`;
    })
    .join("");
  const extra = conexoes.length > itens.length ? `<p class="etiqueta">+${conexoes.length - itens.length} no mapa</p>` : "";
  return `
    <svg class="mini-grafo" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Conexões de ${escapar(pessoa.nome)}">
      ${linhas}
      <circle cx="${cx}" cy="${cy_}" r="17" class="mini-centro" />
      <text x="${cx}" y="${cy_ + 34}" text-anchor="middle" class="mini-centro-rotulo">${escapar(truncar(pessoa.nome, 22))}</text>
      ${nos}
    </svg>${extra}`;
}

function htmlFichaPersonagem(capitulo, pessoa) {
  const versos = versiculosDoPersonagem(capitulo, pessoa);
  const conexoes = conexoesDoPersonagem(pessoa);
  const objetos = objetosComprovados(pessoa);
  const datacoes = conexoes
    .filter(({ no, via }) => no.tipo === "afirmacao" && !via)
    .flatMap(({ no }) => (no.datacao || []).map((d) => ({ ...d, afirmacao: no })));

  const htmlObjetos = objetos.length
    ? `<ul class="ficha-objetos">${objetos
        .map(
          ({ no, aresta, via }) => `<li>
            <button class="ficha-objeto" data-id="${escapar(no.id)}">
              <span class="ficha-objeto-nome">${iconeInline("objeto", corDaCategoria("objeto"))}${escapar(no.nome)}</span>
              <span class="pill ${classePill(aresta.forca)}">${escapar(rotuloForca(aresta.forca))}</span>
            </button>
            <p>${escapar(no.descricao || "")}</p>
            ${via ? `<p class="etiqueta">${escapar(verboDaLigacao(aresta.tipo))}: “${escapar(via.texto.trim().replace(/\.$/, ""))}”</p>` : ""}
          </li>`
        )
        .join("")}</ul>`
    : `<p class="ficha-vazio">Nenhum objeto arqueológico comprovado está ligado a este personagem até agora. Isso não quer dizer que não exista: quer dizer que nenhum foi cadastrado com fonte conferida.</p>`;

  return `
    <p class="ficha-eyebrow">${iconeInline("pessoa", corDaCategoria("pessoa"))}Personagem · ${escapar(capitulo.livro)} ${capitulo.capitulo}</p>
    <h2 id="ficha-titulo">${escapar(pessoa.nome)}</h2>
    ${(pessoa.alias || []).length ? `<p class="ficha-alias">${pessoa.alias.map((a) => `<span>${escapar(a)}</span>`).join("")}</p>` : ""}
    <p class="ficha-descricao">${comCitacoes(pessoa.descricao || "")}</p>

    <dl class="ficha-tecnica">
      <div><dt>Aparece em</dt><dd>${plural(versos.length, "versículo", "versículos")} deste capítulo${
        versos.length ? ` <button class="ficha-realcar" aria-pressed="false">Realçar no texto</button>` : ""
      }</dd></div>
      <div><dt>Conexões</dt><dd>${plural(conexoes.length, "elemento", "elementos")} no mapa</dd></div>
      <div><dt>Objetos comprovados</dt><dd>${objetos.length}</dd></div>
    </dl>

    ${
      datacoes.length
        ? `<section class="ficha-secao"><h3>${iconeUI("datacao")}Datação</h3><ul class="lateral-datacoes">${datacoes
            .map((d) => `<li><strong>${escapar(formatarPeriodo(d.periodo))}</strong><span>${comCitacoes(primeiraFrase(d.segundo_quem.trim())[0])}</span></li>`)
            .join("")}</ul></section>`
        : ""
    }

    <section class="ficha-secao"><h3>${iconeUI("conexoes")}Conexões</h3>${htmlMiniGrafo(pessoa, conexoes)}</section>

    <section class="ficha-secao">
      <h3>${iconeUI("evidencia")}Objetos comprovados historicamente</h3>
      <p class="lateral-dica">Entram só objetos ligados por achado arqueológico ou inscrição, com força “bem estabelecido” ou “aceito pela maioria”.</p>
      ${htmlObjetos}
    </section>

    <button class="card-leitura-mapa ficha-mapa" data-id="${escapar(pessoa.id)}">${iconeUI("conexoes")}Ver ${escapar(pessoa.nome)} no mapa</button>`;
}

function abrirPersonagem(id) {
  const pessoa = noPorId(id);
  const painel = document.querySelector(".ficha-personagem");
  if (!pessoa || !painel || !capituloAberto) return;
  fecharNota({ devolverFoco: false });
  realcarPersonagem(null);
  personagemAberto = id;
  painel.querySelector(".ficha-corpo").innerHTML = htmlFichaPersonagem(capituloAberto.dados, pessoa);
  painel.hidden = false;
  requestAnimationFrame(() => painel.classList.add("aberta"));
  document.querySelectorAll(".chip-personagem").forEach((c) => c.classList.toggle("ativo", c.dataset.id === id));

  const irParaMapa = (alvo) => {
    fecharPersonagem();
    history.pushState(null, "", location.pathname);
    mudarView("mapa");
    centralizarEm(alvo);
  };
  painel.querySelectorAll(".ficha-mapa, .ficha-objeto").forEach((b) => b.addEventListener("click", () => irParaMapa(b.dataset.id)));
  painel.querySelectorAll(".mini-no").forEach((g) => {
    const abrir = () => {
      const no = noPorId(g.dataset.id);
      if (no?.subtipo === "pessoa" && personagensDoCapitulo(capituloAberto.dados).some((p) => p.id === no.id)) abrirPersonagem(no.id);
      else irParaMapa(g.dataset.id);
    };
    g.addEventListener("click", abrir);
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        abrir();
      }
    });
  });
  const realcar = painel.querySelector(".ficha-realcar");
  realcar?.addEventListener("click", () => {
    const ligado = realcar.getAttribute("aria-pressed") !== "true";
    realcar.setAttribute("aria-pressed", String(ligado));
    realcarPersonagem(ligado ? id : null);
  });
  painel.querySelector(".ficha-fechar").focus({ preventScroll: true });
}

function fecharPersonagem() {
  const painel = document.querySelector(".ficha-personagem");
  if (!painel || painel.hidden) return;
  painel.classList.remove("aberta");
  realcarPersonagem(null);
  document.querySelectorAll(".chip-personagem.ativo").forEach((c) => c.classList.remove("ativo"));
  const id = personagemAberto;
  personagemAberto = null;
  setTimeout(() => (painel.hidden = !painel.classList.contains("aberta") ? true : painel.hidden), animacoesOk() ? 220 : 0);
  document.querySelector(`.chip-personagem[data-id="${CSS.escape(id || "")}"]`)?.focus({ preventScroll: true });
}

function realcarPersonagem(id) {
  document.querySelectorAll(".versiculo.do-personagem").forEach((v) => v.classList.remove("do-personagem"));
  if (!id || !capituloAberto) return;
  const pessoa = noPorId(id);
  for (const n of versiculosDoPersonagem(capituloAberto.dados, pessoa)) {
    document.querySelector(`#v-${n}`)?.classList.add("do-personagem");
  }
}

function htmlChipsPersonagens(capitulo) {
  const pessoas = personagensDoCapitulo(capitulo);
  if (!pessoas.length) return "";
  return `<ul class="chips-personagens" aria-label="Personagens do capítulo">${pessoas
    .map((p) => {
      const n = versiculosDoPersonagem(capitulo, p).length;
      return `<li><button class="chip-personagem" data-id="${escapar(p.id)}" aria-haspopup="dialog" title="Ficha técnica de ${escapar(
        p.nome
      )}">${iconeInline("pessoa", corDaCategoria("pessoa"))}<span>${escapar(p.nome)}</span><span class="chip-contagem">${n}</span></button></li>`;
    })
    .join("")}</ul>`;
}

function ligarPersonagens(raiz) {
  raiz.querySelectorAll(".chip-personagem").forEach((chip) => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      if (personagemAberto === chip.dataset.id) fecharPersonagem();
      else abrirPersonagem(chip.dataset.id);
    });
    chip.addEventListener("mouseenter", () => {
      if (!personagemAberto) realcarPersonagem(chip.dataset.id);
    });
    chip.addEventListener("mouseleave", () => {
      if (!personagemAberto) realcarPersonagem(null);
    });
  });
  const painel = raiz.querySelector(".ficha-personagem");
  painel?.querySelector(".ficha-fechar").addEventListener("click", () => fecharPersonagem());
  painel?.addEventListener("click", (e) => e.stopPropagation());
}

// A aba Passagens é a Bíblia: abre o capítulo em leitura (ou o primeiro).
function abrirBiblia() {
  const id = capituloAberto?.dados.id || indiceCapitulos[0]?.id;
  if (id) abrirCapitulo(id);
  else mudarView("passagens");
}

function sincronizarLeituraComHash() {
  const id = lerCapituloDoHash();
  if (id && id !== capituloAberto?.dados.id) abrirCapitulo(id, { atualizarHash: false });
  else if (id) mudarView("leitura");
  else if (document.querySelector("#view-leitura") && !document.querySelector("#view-leitura").hidden) mudarView("mapa");
}

// --- Fio da narrativa ---------------------------------------------------------

// A espinha é a ORDEM DO TEXTO, não uma linha do tempo. Gênesis 2 vem depois
// de Gênesis 1 no livro, e isso não afirma nada sobre quando cada coisa
// aconteceu — o projeto não tem fonte para isso e não vai insinuar por
// layout o que não escreveria como afirmação. As datações ficam onde têm
// fonte: dentro dos cards e no nó do livro. A tela diz isso ao visitante.

let fio = null;
let cardDoFioAberto = null; // "<capitulo>::<grupo>"

const GRUPOS_FIO = {
  paralelo: { rotulo: "Paralelos", icone: "paralelo", cor: "var(--violeta)" },
  ciencia: { rotulo: "O que a ciência diz", icone: "ciencia", cor: "var(--cor-lugar)" },
  leitura: { rotulo: "Leituras", icone: "leitura", cor: "var(--cor-pessoa)" },
  contexto: { rotulo: "Contexto", icone: "conexoes", cor: "var(--muted)" },
  nota: { rotulo: "Notas do texto", icone: "traducao", cor: "var(--teal)" },
};

function lerCapituloDoFioNoHash() {
  const achado = /^#fio(?:=(.+))?$/.exec(location.hash);
  if (!achado) return undefined; // não está no fio
  return achado[1] ? decodeURIComponent(achado[1]) : null; // no fio, sem capítulo
}

// O conteúdo de um card sai do grafo.json que já está em memória: o fio.json
// carrega só o id da ligação. Uma ligação que não esteja no grafo é descartada
// em silêncio — dado inconsistente não vira card inventado.
function itensDoGrupo(capitulo, grupo) {
  if (grupo.grupo === "nota") {
    return grupo.notas.map((nota) => ({
      titulo: nota.titulo,
      versiculos: nota.versiculos,
      tema: nota.tipo,
      aresta: null,
      destino: null,
    }));
  }
  return grupo.ligacoes
    .map((conexao) => {
      const aresta = grafo.arestas.find((a) => a.ligacao === conexao.ligacao);
      if (!aresta) return null;
      // A ponta que interessa é a que NÃO é a passagem nem o livro: é o que
      // o capítulo puxa junto (o Enuma Elish, a missão Planck, o Catecismo).
      const origem = noPorId(aresta.origem);
      const destino = noPorId(aresta.destino);
      const externo =
        [origem, destino].find((n) => n && n.id !== capitulo.passagem && categoriaDoNo(n) !== "livro") || origem;
      return {
        titulo: externo ? rotuloDoNo(externo) : rotuloLigacao(aresta),
        versiculos: conexao.versiculos,
        tema: conexao.tema,
        aresta,
        destino: externo,
      };
    })
    .filter(Boolean);
}

function referenciaCurta(capitulo, [inicio, fim]) {
  return inicio === fim ? `v. ${inicio}` : `v. ${inicio}–${fim}`;
}

// O mini-grafo: a passagem no centro e o que ela puxa ao redor, com as MESMAS
// convenções do mapa — dourado para ligação com evidência, violeta e sem seta
// para 'paralelo' (que afirma semelhança, não dependência), tracejado para as
// estruturais. Desenhado em SVG e não numa segunda instância de Cytoscape:
// aqui não há layout de força nem navegação, e um grafo de 2 a 6 nós numa
// disclosure não justifica subir um motor inteiro por card aberto.
function miniGrafo(capitulo, itens) {
  const linhas = itens
    .map((item, i) => {
      const cor = item.aresta?.tipo === "paralelo" ? "var(--violeta)" : item.aresta ? "var(--ouro)" : "var(--teal)";
      const semSeta = !item.aresta || item.aresta.tipo === "paralelo";
      const categoria = item.destino ? categoriaDoNo(item.destino) : "afirmacao";
      return `
      <li class="fio-mini-item" style="--cor-item:${cor}">
        <span class="fio-mini-linha${semSeta ? "" : " com-seta"}" aria-hidden="true"></span>
        <span class="fio-mini-no" style="--cor-no:${corDaCategoria(categoria)}" aria-hidden="true">${iconeInline(
          categoria,
          "currentColor"
        )}</span>
        ${
          // O item inteiro é o controle. Um botão "Ver no mapa" por linha
          // dobrava a altura do card aberto e empurrava a espinha para fora
          // da tela num grupo de seis leituras.
          item.destino
            ? `<button type="button" class="fio-mini-texto fio-mini-ir" data-ficha="${escapar(item.destino.id)}"
                 title="Abrir a ficha">`
            : `<span class="fio-mini-texto">`
        }
          <span class="fio-mini-titulo">${escapar(item.titulo)}</span>
          <span class="fio-mini-meta">${escapar(referenciaCurta(capitulo, item.versiculos))}${
            item.aresta ? ` · ${escapar(rotuloTipoLigacao(item.aresta.tipo))}` : ""
          }${item.aresta?.forca ? ` · ${escapar(rotuloForca(item.aresta.forca))}` : ""}</span>
        ${item.destino ? "</button>" : "</span>"}
      </li>`;
    })
    .join("");
  return `
    <div class="fio-mini">
      <p class="fio-mini-raiz"><span class="fio-mini-no raiz" style="--cor-no:${corDaCategoria(
        "passagem"
      )}" aria-hidden="true">${iconeInline("passagem", "currentColor")}</span>${escapar(capitulo.referencia)}</p>
      <ul class="fio-mini-lista">${linhas}</ul>
    </div>`;
}

function cardDoFio(capitulo, grupo) {
  const meta = GRUPOS_FIO[grupo.grupo];
  const itens = itensDoGrupo(capitulo, grupo);
  if (itens.length === 0) return "";
  const chave = `${capitulo.id}::${grupo.grupo}`;
  const aberto = cardDoFioAberto === chave;
  const previa = itens
    .slice(0, 2)
    .map((i) => escapar(truncar(i.titulo, 42)))
    .join(" · ");
  return `
    <div class="fio-card${aberto ? " aberto" : ""}" style="--cor-card:${meta.cor}">
      <button type="button" class="fio-card-botao" data-card="${escapar(chave)}"
              aria-expanded="${aberto}" aria-controls="painel-${escapar(chave.replace("::", "-"))}">
        <span class="fio-card-topo">${iconeUI(meta.icone)}<span class="fio-card-rotulo">${escapar(
          meta.rotulo
        )}</span><span class="fio-card-total">${itens.length}</span></span>
        <span class="fio-card-previa">${previa}</span>
      </button>
      <div class="fio-card-painel" id="painel-${escapar(chave.replace("::", "-"))}"${aberto ? "" : " hidden"}>
        ${aberto ? miniGrafo(capitulo, itens) : ""}
        <div class="fio-card-acoes">
          <button type="button" class="fio-acao" data-ler="${escapar(capitulo.id)}">Ler o capítulo</button>
          <button type="button" class="fio-acao" data-ir-no="${escapar(capitulo.passagem)}">Ver no mapa</button>
        </div>
      </div>
    </div>`;
}

function noDoCapitulo(capitulo) {
  const comConteudo = capitulo.grupos.filter((g) => g.total > 0);
  // Alternância: o primeiro card vai para cima, o segundo para baixo, e assim
  // por diante — é o que dá o desenho de espinha em vez de uma lista.
  const cima = comConteudo.filter((_, i) => i % 2 === 0);
  const baixo = comConteudo.filter((_, i) => i % 2 === 1);
  const cards = (grupos) => grupos.map((g) => cardDoFio(capitulo, g)).join("");
  return `
    <li class="fio-no" data-capitulo="${escapar(capitulo.id)}">
      <div class="fio-ramo fio-ramo-cima">${cards(cima)}</div>
      <div class="fio-marco-area">
        <button type="button" class="fio-marco" data-ler="${escapar(capitulo.id)}"
                aria-label="${escapar(`${capitulo.referencia} — ${capitulo.titulo || ""}. Abrir a leitura.`)}">
          <span class="fio-marco-num">${capitulo.capitulo}</span>
        </button>
      </div>
      <p class="fio-marco-titulo">${escapar(capitulo.titulo || "")}</p>
      <div class="fio-ramo fio-ramo-baixo">${cards(baixo)}</div>
    </li>`;
}

function datacaoEmLinha(d) {
  return `<li><span class="periodo">${escapar(formatarPeriodo(d.periodo))}</span>
    <p class="texto">${comCitacoes(d.texto)}</p>
    <p class="fonte">${comCitacoes(d.segundo_quem)}</p></li>`;
}

function noDoLivro(livro) {
  if (!livro) return "";
  return `
    <li class="fio-no fio-no-livro">
      <div class="fio-ramo fio-ramo-cima"></div>
      <div class="fio-marco-area">
        <button type="button" class="fio-marco marco-livro" data-ir-no="${escapar(livro.registro)}"
                aria-label="${escapar(`${livro.nome}: abrir a ficha do livro no mapa.`)}">
          ${iconeInline("livro", "currentColor")}
        </button>
      </div>
      <p class="fio-marco-titulo">${escapar(livro.nome)}</p>
      <div class="fio-ramo fio-ramo-baixo">
        ${
          livro.datacoes.length
            ? `<details class="fio-datacao">
                 <summary>${iconeUI("datacao")}Quando o texto foi escrito<span class="fio-card-total">${
                   livro.datacoes.length
                 }</span></summary>
                 <ol class="linha-tempo">${livro.datacoes.map(datacaoEmLinha).join("")}</ol>
               </details>`
            : ""
        }
      </div>
    </li>`;
}

function montarFio() {
  const painel = document.querySelector("#view-fio");
  if (!painel || !fio) return;
  const capitulos = fio.capitulos;
  const total = fio.livro?.total_capitulos;
  const faltam = total ? total - capitulos.length : 0;

  painel.innerHTML = `
    <div class="fio-topo">
      <h2>Fio da narrativa</h2>
      <p class="fio-aviso">${iconeUI("limites")}<span>A posição na linha é a <strong>ordem do texto</strong>, não a
        ordem dos acontecimentos. As datações, com fonte, estão nos cards e no nó do livro.</span></p>
    </div>
    <div class="fio-rolagem">
      <ol class="fio-espinha">
        ${noDoLivro(fio.livro)}
        ${capitulos.map(noDoCapitulo).join("")}
        ${
          faltam > 0
            ? `<li class="fio-no fio-no-resto">
                 <div class="fio-ramo fio-ramo-cima"></div>
                 <div class="fio-marco-area">
                   <span class="fio-marco marco-resto" aria-hidden="true">+${faltam}</span>
                 </div>
                 <p class="fio-marco-titulo">${escapar(
                   plural(faltam, "capítulo por mapear", "capítulos por mapear")
                 )}</p>
                 <div class="fio-ramo fio-ramo-baixo"></div>
               </li>`
            : ""
        }
      </ol>
    </div>
    ${
      fio.fora_do_fio.length
        ? `<details class="fio-fora">
             <summary>Datações ainda fora do fio<span class="fio-card-total">${fio.fora_do_fio.length}</span></summary>
             <p class="etiqueta">Têm fonte e estão no mapa, mas ainda não foram ancoradas em nenhum capítulo.</p>
             <ol class="linha-tempo">${fio.fora_do_fio.map(datacaoEmLinha).join("")}</ol>
           </details>`
        : ""
    }`;

  ligarAcoesDoFio(painel);
}

function ligarAcoesDoFio(raiz) {
  raiz.querySelectorAll("[data-card]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const chave = botao.dataset.card;
      cardDoFioAberto = cardDoFioAberto === chave ? null : chave;
      montarFio();
      // Remontar troca o nó sob o foco: devolver o foco ao mesmo card é o que
      // mantém o teclado no lugar em vez de jogá-lo para o topo da página.
      raiz.querySelector(`[data-card="${CSS.escape(chave)}"]`)?.focus({ preventScroll: true });
    });
  });
  raiz.querySelectorAll("[data-ler]").forEach((botao) => {
    botao.addEventListener("click", () => abrirCapitulo(botao.dataset.ler));
  });
  // A ficha abre POR CIMA do fio: quem clicou num item quer ler sobre aquele
  // item, não perder o lugar na espinha. Fechar a ficha devolve o foco ao
  // mesmo item. Só o botão rotulado "Ver no mapa" troca de tela.
  raiz.querySelectorAll("[data-ficha]").forEach((botao) => {
    botao.addEventListener("click", () => abrirDossie(botao.dataset.ficha));
  });
  raiz.querySelectorAll("[data-ir-no]").forEach((botao) => {
    botao.addEventListener("click", () => {
      mudarView("mapa");
      centralizarEm(botao.dataset.irNo);
      abrirDossie(botao.dataset.irNo);
    });
  });
  // ← → andam de capítulo em capítulo pela espinha.
  raiz.querySelectorAll(".fio-marco").forEach((marco, i, todos) => {
    marco.addEventListener("keydown", (e) => {
      const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!passo) return;
      e.preventDefault();
      todos[i + passo]?.focus();
      todos[i + passo]?.scrollIntoView({ inline: "center", block: "nearest", behavior: animacoesOk() ? "smooth" : "auto" });
    });
  });
}

async function carregarFio() {
  fio = await carregarJSON("fio.json");
  if (!fio) return;
  // Esc fecha o card aberto sem sair da aba. Registrado aqui, e não em
  // ligarAcoesDoFio: #view-fio sobrevive às remontagens, e um listener por
  // remontagem viraria uma pilha que dispara montarFio N vezes por Esc.
  document.querySelector("#view-fio")?.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !cardDoFioAberto) return;
    e.stopPropagation();
    cardDoFioAberto = null;
    montarFio();
  });
  montarFio();
}

function sincronizarFioComHash() {
  const capitulo = lerCapituloDoFioNoHash();
  if (capitulo === undefined) return false;
  mudarView("fio");
  if (capitulo) {
    const alvo = document.querySelector(`[data-capitulo="${CSS.escape(capitulo)}"] .fio-marco`);
    alvo?.scrollIntoView({ inline: "center", block: "nearest" });
    alvo?.focus({ preventScroll: true });
  }
  return true;
}

// --- Início ---------------------------------------------------------------

async function iniciar() {
  mostrarEstadoMapa("carregando");
  try {
    const grafoData = (await carregarJSON("grafo.json")) || { nos: [], arestas: [] };
    iniciarGrafo(grafoData);
    montarPassagens();
    await carregarIndiceCapitulos();
    await carregarFio();
    window.addEventListener("hashchange", sincronizarLeituraComHash);
    window.addEventListener("popstate", sincronizarLeituraComHash);
    window.addEventListener("hashchange", sincronizarFioComHash);
    configurarBiblia();
    window.addEventListener("resize", () => {
      if (!cy) return;
      cy.resize();
      atualizarAlca(); // girar o celular muda a altura, e a alça pode deixar de caber
    });
    // Depois do grafo de pe: um link com #dossie=<id> abre direto na ficha,
    // e um com #capitulo=<id> abre direto a leitura.
    sincronizarDossieComHash();
    sincronizarLeituraComHash();
    sincronizarFioComHash();
  } catch (erro) {
    // Rede de segurança final: qualquer falha inesperada aqui não pode
    // deixar a tela travada em "carregando" para sempre.
    console.error("Falha ao iniciar a página:", erro);
    mostrarEstadoMapa("erro");
  }
}

document.querySelector("#btn-tentar-novamente")?.addEventListener("click", iniciar);

iniciar();
