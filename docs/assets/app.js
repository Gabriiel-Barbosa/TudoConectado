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
  botao.addEventListener("click", () => mudarView(botao.dataset.view));
});

function mudarView(nome) {
  botoesNav.forEach((b) => {
    const ativo = b.dataset.view === nome;
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
      selector: "edge[tipo='cita'], edge[tipo='envolve']",
      style: {
        "line-style": "dashed",
        "line-color": cores.muted,
        "target-arrow-shape": "none",
        width: 1,
        opacity: 0.35,
      },
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

let layoutAtual = null;

// Roda o layout só sobre o que está visível: nós de tipo oculto e arestas
// filtradas não ocupam lugar na árvore nem entram no enquadramento.
function rodarLayout(raiz) {
  if (layoutAtual) layoutAtual.stop();
  layoutAtual = cy.elements(":visible").layout({
    name: "breadthfirst",
    ...(raiz ? { roots: raiz } : {}),
    circle: true,
    spacingFactor: 1.4,
    padding: 60,
    animate: animacoesOk(),
    animationDuration: 400,
  });
  layoutAtual.run();
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
function atualizarAlca() {
  const alca = document.querySelector("#alca-detalhes");
  if (!alca) return;
  const emFoco = cy ? cy.nodes(".foco") : null;
  const no = emFoco && emFoco.nonempty() ? noPorId(emFoco.id()) : null;
  const cardFechado = document.querySelector("#detalhes").classList.contains("oculto");
  const controlesFechados = document.querySelector("#mapa-controles").classList.contains("oculto");
  alca.hidden = !(ehMovel() && no && cardFechado && controlesFechados);
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

const ehEstrutural = (tipo) => tipo === "cita" || tipo === "envolve";

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
  return rotuloTipoLigacao(aresta.tipo);
}

function formatarAno(ano) {
  return ano < 0 ? `${Math.abs(ano)} a.C.` : `${ano} d.C.`;
}

function formatarPeriodo(periodo) {
  if (!Array.isArray(periodo) || periodo.length < 2) return "";
  const [inicio, fim] = periodo;
  return inicio === fim ? formatarAno(inicio) : `${formatarAno(inicio)} – ${formatarAno(fim)}`;
}

// A ligação tem sentido: origem é quem confirma/contradiz/foi copiado,
// destino é o alvo (regra checada por validarDirecaoDeLigacao). Lida a partir
// do alvo, a relação vira a voz passiva — "confirmado por", não "confirma".
const VOZ_PASSIVA = {
  confirma: "confirmado por",
  contradiz: "contradito por",
  foi_copiado_de: "copiado por",
};

function verboDaLigacao(tipo, lidoDaOrigem = true) {
  if (!lidoDaOrigem && VOZ_PASSIVA[tipo]) return VOZ_PASSIVA[tipo];
  return rotuloTipoLigacao(tipo);
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
    const itens = idx.datacoes
      .slice(0, 2)
      .map((d) => {
        const deQual =
          d.afirmacao.id === no.id
            ? ""
            : `<span class="datacao-de">Data para “${escapar(truncar(d.afirmacao.texto.trim(), 80))}”</span>`;
        return `<li>${deQual}<strong>${escapar(formatarPeriodo(d.periodo))}</strong><span class="etiqueta" title="${escapar(
          d.segundo_quem.trim()
        )}">Base: ${comCitacoes(truncar(d.segundo_quem.trim(), 110))}</span></li>`;
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

function blocoDescricao(no) {
  const texto = (no.descricao || no.texto || "").trim();
  if (!texto) return "";
  const [inicio, resto] = dividirNaFrase(texto);
  if (!resto) return `<p class="descricao">${comCitacoes(texto)}</p>`;
  return `
    <p class="descricao">${comCitacoes(inicio)}</p>
    <details class="mais"><summary>Continuar lendo</summary><p class="descricao">${comCitacoes(resto)}</p></details>`;
}

// "Por que está aqui" derivado das ligações incidentes e seus tipos — não
// prosa editorial (ver seção 0 da issue #1).
function blocoRelevancia(no, idx) {
  if (idx.ligacoes.length === 0) return "";
  // Nomeia com quem é cada ligação — "confirma (1)" sozinho não dizia o
  // que confirma o quê.
  const resumo = idx.ligacoes.map((c) => `${verboDaLigacao(c.aresta.tipo, c.saindo)} ${rotuloDoNo(c.outro)}`).join("; ");
  return `<p class="relevancia">${escapar(
    plural(idx.ligacoes.length, "ligação com evidência", "ligações com evidência")
  )}: ${escapar(resumo)}.</p>`;
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
        `<li><strong>${escapar(formatarPeriodo(d.periodo))}</strong><span class="etiqueta">Base: ${comCitacoes(
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
  return `<div class="acoes-card"><button class="abrir-dossie" data-id="${no.id}">Ver ficha completa</button></div>`;
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
  if (aresta.tipo === "cita" || aresta.tipo === "envolve") {
    const frase =
      aresta.tipo === "cita"
        ? `${escapar(rotuloPorId(aresta.origem))} cita ${escapar(rotuloPorId(aresta.destino))}.`
        : `${escapar(rotuloPorId(aresta.origem))} é uma afirmação sobre ${escapar(rotuloPorId(aresta.destino))}.`;
    corpo.innerHTML = `
      ${eyebrow(cores.muted, aresta.tipo === "cita" ? "Cita" : "Envolve")}
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
            <strong>${escapar(p.referencia)}</strong>
            <span class="etiqueta">${plural(citacoes, "citação", "citações")}${p.nenhum_paralelo_conhecido ? " · nenhum paralelo externo conhecido" : ""}</span>
          </button>
        </li>
      `;
    })
    .join("");

  painel.innerHTML = `<ul class="lista-passagens">${itens}</ul>`;
  painel.querySelectorAll(".ver-no-grafo").forEach((botao) => {
    botao.addEventListener("click", () => {
      mudarView("mapa");
      centralizarEm(botao.dataset.id);
    });
  });
}

// --- Timeline -----------------------------------------------------------------

async function montarTimeline() {
  const timeline = await carregarJSON("timeline.json");
  if (!timeline || timeline.length === 0) return;
  const painel = document.querySelector("#view-timeline");
  const itens = timeline
    .map(
      (e) => `
      <li>
        <span class="periodo">${escapar(formatarPeriodo(e.periodo))}</span>
        <p class="texto">${comCitacoes(e.texto)}</p>
        <p class="fonte">Base: ${comCitacoes(e.segundo_quem)}</p>
      </li>`
    )
    .join("");
  painel.innerHTML = `<ol class="linha-tempo">${itens}</ol>`;
}

// --- Início ---------------------------------------------------------------

async function iniciar() {
  mostrarEstadoMapa("carregando");
  try {
    const grafoData = (await carregarJSON("grafo.json")) || { nos: [], arestas: [] };
    iniciarGrafo(grafoData);
    montarPassagens();
    await montarTimeline();
    window.addEventListener("resize", () => cy && cy.resize());
    // Depois do grafo de pe: um link com #dossie=<id> abre direto na ficha.
    sincronizarDossieComHash();
  } catch (erro) {
    // Rede de segurança final: qualquer falha inesperada aqui não pode
    // deixar a tela travada em "carregando" para sempre.
    console.error("Falha ao iniciar a página:", erro);
    mostrarEstadoMapa("erro");
  }
}

document.querySelector("#btn-tentar-novamente")?.addEventListener("click", iniciar);

iniciar();
