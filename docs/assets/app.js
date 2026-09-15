// Página estática: troca de abas + grafo navegável (Cytoscape.js) lendo
// grafo.json/timeline.json gerados por scripts/compilar.js. Nenhum dado é
// editado aqui — isso é só leitura/visualização (ver seção 7 da arquitetura).

const botoesNav = document.querySelectorAll("nav button[data-view]");
const paineis = document.querySelectorAll("[data-view-panel]");
const tooltip = document.querySelector("#tooltip");

let cy = null;
let grafo = { nos: [], arestas: [] };
let historico = [];
const cores = lerCores();

// Registros tipo=texto tratados como "livro" — o ponto de partida da
// árvore, por cima até de Passagem (a base é a Bíblia e seus livros;
// capítulos e conexões nascem dali). Só Gênesis por enquanto; quando outro
// livro entrar, soma aqui (ou isso vira um campo próprio no schema).
const LIVROS_RAIZ = ["genesis"];

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
  const nos = g.nos.map((no) => ({
    data: { ...no, rotulo: rotuloDoNo(no) },
  }));
  const arestas = g.arestas.map((aresta) => ({
    data: { ...aresta, source: aresta.origem, target: aresta.destino },
  }));
  return [...nos, ...arestas];
}

function estilosCytoscape() {
  return [
    {
      // Nós, por padrão: cartão escuro com borda fina na cor da categoria —
      // a cor carrega o significado, o preenchimento fica discreto.
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
        shape: "round-rectangle",
        width: "data(tamanho)",
        height: "data(tamanho)",
        "background-color": cores.cartaoNo,
        "border-width": 2,
        "border-color": cores.muted,
        "transition-property": "opacity, text-opacity, border-width",
        "transition-duration": "150ms",
      },
    },
    { selector: "node[subtipo='pessoa']", style: { "border-color": cores.pessoa } },
    { selector: "node[subtipo='lugar']", style: { "border-color": cores.lugar } },
    { selector: "node[subtipo='acontecimento']", style: { "border-color": cores.acontecimento } },
    { selector: "node[subtipo='texto']", style: { "border-color": cores.texto } },
    { selector: "node[subtipo='objeto']", style: { "border-color": cores.objeto } },
    { selector: "node[tipo='afirmacao']", style: { "border-color": cores.afirmacao } },

    // A Passagem é um ponto de partida da árvore — vira um orbe cheio e
    // "aceso", em vez de mais um cartão, pra puxar o olho pro centro.
    {
      selector: "node[tipo='passagem']",
      style: {
        shape: "ellipse",
        "background-color": cores.passagem,
        "border-width": 9,
        "border-color": cores.passagem,
        "border-opacity": 0.3,
        color: cores.fg,
        "font-weight": 600,
      },
    },

    // O Livro (ver LIVROS_RAIZ) é a raiz de tudo — a base é a Bíblia e seus
    // livros, capítulos e conexões nascem dali. Mesmo tratamento de orbe da
    // Passagem, mas na cor de "texto" (é um registro tipo=texto) e maior,
    // porque fica acima até da Passagem na hierarquia.
    {
      selector: `node[id = "${LIVROS_RAIZ.join('"], node[id = "')}"]`,
      style: {
        shape: "ellipse",
        "background-color": cores.texto,
        "border-width": 11,
        "border-color": cores.texto,
        "border-opacity": 0.3,
        color: cores.fg,
        "font-weight": 700,
        "font-size": 12,
      },
    },

    { selector: "node.foco", style: { "border-width": 4, "border-opacity": 1 } },
    { selector: "node.escondido", style: { display: "none" } },
    { selector: ".baixo-contraste", style: { opacity: 0.1, "text-opacity": 0.1 } },

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
    n.data("tamanho", 22 + proporcao * 26);
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
      layout: { name: "breadthfirst", circle: true, spacingFactor: 1.4, animate: animacoesOk() },
      wheelSensitivity: 0.3,
    });

    aplicarTamanhoPorGrau();

    cy.on("tap", "node", (evento) => centralizarEm(evento.target.id()));
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

    cy.on("mouseover", "node", (evento) => mostrarTooltip(evento.target.data()));
    cy.on("mouseout", "node", () => (tooltip.hidden = true));
    cy.on("mousemove", (evento) => posicionarTooltip(evento.originalEvent));
  } catch (erro) {
    console.error("Falha ao iniciar o grafo:", erro);
    mostrarEstadoMapa("erro");
    return;
  }

  // O grafo em si já está de pé nesse ponto (Cytoscape criado com sucesso).
  // Um erro aqui embaixo é só nos controles ao redor — não faz sentido
  // esconder um grafo que já funciona por causa de um filtro que quebrou.
  mostrarEstadoMapa("layout");
  try {
    document.querySelector("#stat-grafo").textContent = `${grafo.nos.length} nó(s) · ${grafo.arestas.length} ligação(ões)`;

    montarLegenda();
    montarSeletorRaiz();
    montarFiltros();
    configurarBusca();
    configurarFerramentas();
    configurarPaineisMoveis();

    // A árvore nasce do livro — só cai pra uma passagem se nenhum livro
    // estiver carregado (ver LIVROS_RAIZ).
    const raizInicial =
      grafo.nos.find((n) => LIVROS_RAIZ.includes(n.id)) || grafo.nos.find((n) => n.tipo === "passagem");
    if (raizInicial) centralizarEm(raizInicial.id);
  } catch (erro) {
    console.error("Falha ao montar os controles do grafo:", erro);
  }
}

function mostrarTooltip(no) {
  tooltip.innerHTML = `<strong>${escapar(rotuloDoNo(no))}</strong><span>${escapar(no.subtipo || no.tipo)}</span>`;
  tooltip.hidden = false;
}

function posicionarTooltip(eventoOriginal) {
  if (!eventoOriginal || tooltip.hidden) return;
  tooltip.style.left = `${eventoOriginal.clientX + 14}px`;
  tooltip.style.top = `${eventoOriginal.clientY + 14}px`;
}

function centralizarEm(id, { registrarHistorico = true } = {}) {
  if (!cy || cy.$id(id).empty()) return;
  const alvo = cy.$id(id);

  cy.layout({
    name: "breadthfirst",
    roots: alvo,
    circle: true,
    spacingFactor: 1.4,
    animate: animacoesOk(),
    animationDuration: 400,
  }).run();

  const seletor = document.querySelector("#seletor-raiz");
  if (seletor && [...seletor.options].some((o) => o.value === id)) seletor.value = id;

  cy.elements().removeClass("foco");
  alvo.addClass("foco");
  aplicarFoco(alvo);

  if (registrarHistorico) {
    historico = historico.filter((h) => h !== id);
    historico.push(id);
    if (historico.length > 8) historico.shift();
  }
  renderizarTrilha();

  const no = grafo.nos.find((n) => n.id === id);
  if (no) {
    mostrarDetalhesNo(no);
    abrirDetalhesSeMovel();
  }
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

function aplicarFoco(colecao) {
  const vizinhanca = colecao.closedNeighborhood();
  cy.elements().addClass("baixo-contraste");
  vizinhanca.removeClass("baixo-contraste");
}

function limparFoco() {
  if (cy) cy.elements().removeClass("baixo-contraste").removeClass("foco");
}

function renderizarTrilha() {
  const trilha = document.querySelector("#trilha");
  if (historico.length <= 1) {
    trilha.hidden = true;
    return;
  }
  trilha.hidden = false;
  trilha.innerHTML = historico
    .map((id, indice) => {
      const no = grafo.nos.find((n) => n.id === id);
      const rotulo = no ? rotuloDoNo(no) : id;
      const atual = indice === historico.length - 1;
      const separador = indice < historico.length - 1 ? '<span class="separador">›</span>' : "";
      return `<button class="chip${atual ? " atual" : ""}" data-id="${id}">${escapar(truncar(rotulo, 22))}</button>${separador}`;
    })
    .join("");

  trilha.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const indice = historico.indexOf(chip.dataset.id);
      historico = historico.slice(0, indice + 1);
      centralizarEm(chip.dataset.id, { registrarHistorico: false });
    });
  });
}

function montarLegenda() {
  const itens = [
    ["Livro", cores.texto, "forma-diamante"],
    ["Passagem", cores.passagem, "forma-diamante"],
    ["Afirmação", cores.afirmacao, ""],
    ["Pessoa", cores.pessoa, "forma-circulo"],
    ["Lugar", cores.lugar, "forma-circulo"],
    ["Acontecimento", cores.acontecimento, "forma-circulo"],
    ["Texto", cores.texto, "forma-circulo"],
    ["Objeto", cores.objeto, "forma-circulo"],
  ];
  document.querySelector("#legenda").innerHTML = itens
    .map(
      ([rotulo, cor, forma]) =>
        `<span class="item-legenda"><i class="forma ${forma}" style="background:${cor};color:${cor}"></i>${rotulo}</span>`
    )
    .join("");
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
  texto.textContent = valor.replace(/_/g, " ");
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
                  <span class="ponto" style="background:${corDoNo(no)}"></span>
                  ${escapar(rotuloDoNo(no))}
                  <span class="etiqueta">${escapar(no.subtipo || no.tipo)}</span>
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
  if (no.tipo === "passagem") return cores.passagem;
  if (no.tipo === "afirmacao") return cores.afirmacao;
  return cores[no.subtipo] || cores.muted;
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

function mostrarDetalhesNo(no) {
  const painel = document.querySelector("#detalhes");
  if (no.tipo === "registro") {
    painel.innerHTML = `
      ${eyebrow(corDoNo(no), no.subtipo)}
      <h2>${escapar(no.nome)}</h2>
      ${no.alias?.length ? `<p class="etiqueta">${no.alias.map(escapar).join(" · ")}</p>` : ""}
      <p>${escapar(no.descricao || "")}</p>
    `;
  } else if (no.tipo === "afirmacao") {
    const datacoes = (no.datacao || [])
      .map((d) => `<li>[${d.periodo[0]}, ${d.periodo[1]}] — ${escapar(d.segundo_quem)}</li>`)
      .join("");
    painel.innerHTML = `
      ${eyebrow(corDoNo(no), "Afirmação")}
      <p>${escapar(no.texto)}</p>
      ${datacoes ? `<h3>Datação</h3><ul>${datacoes}</ul>` : ""}
    `;
  } else if (no.tipo === "passagem") {
    const afirma = (no.afirma || []).map((a) => `<li>${escapar(a)}</li>`).join("");
    painel.innerHTML = `
      ${eyebrow(corDoNo(no), "Passagem")}
      <h2>${escapar(no.referencia)}</h2>
      ${afirma ? `<ul>${afirma}</ul>` : ""}
      ${no.nenhum_paralelo_conhecido ? '<p class="cartao-aviso">Nenhum paralelo externo conhecido.</p>' : ""}
    `;
  }
}

function rotuloPorId(id) {
  const no = grafo.nos.find((n) => n.id === id);
  return no ? rotuloDoNo(no) : id;
}

function mostrarDetalhesAresta(aresta) {
  const painel = document.querySelector("#detalhes");
  if (aresta.tipo === "cita") {
    painel.innerHTML = `${eyebrow(cores.muted, "Cita")}<p>${escapar(rotuloPorId(aresta.origem))} cita ${escapar(rotuloPorId(aresta.destino))}.</p>`;
    return;
  }
  if (aresta.tipo === "envolve") {
    painel.innerHTML = `${eyebrow(cores.muted, "Envolve")}<p>${escapar(rotuloPorId(aresta.origem))} é uma afirmação sobre ${escapar(rotuloPorId(aresta.destino))}.</p>`;
    return;
  }
  const fontes = (aresta.fontes || []).map((f) => `<li>nível ${f.nivel} — ${escapar(f.descricao)}</li>`).join("");
  painel.innerHTML = `
    ${eyebrow(cores.ouro, "Ligação")}
    <h2>${escapar(aresta.tipo)}</h2>
    <span class="pill ${classePill(aresta.forca)}">${escapar((aresta.forca || "—").replace(/_/g, " "))}</span>
    ${fontes ? `<h3>Fontes</h3><ul>${fontes}</ul>` : ""}
    ${aresta.o_que_derrubaria ? `<div class="cartao-insight"><p class="cartao-insight-cabecalho">O que derrubaria isso</p><p>${escapar(aresta.o_que_derrubaria)}</p></div>` : ""}
  `;
}

function limparDetalhes() {
  document.querySelector("#detalhes").innerHTML = '<p class="vazio">Clique em um nó ou em uma ligação para ver os detalhes.</p>';
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
            <span class="etiqueta">${citacoes} citação(ões)${p.nenhum_paralelo_conhecido ? " · nenhum paralelo externo conhecido" : ""}</span>
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
        <span class="periodo">${e.periodo[0]} a ${e.periodo[1]}</span>
        <p class="texto">${escapar(e.texto)}</p>
        <p class="fonte">segundo ${escapar(e.segundo_quem)}</p>
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
  } catch (erro) {
    // Rede de segurança final: qualquer falha inesperada aqui não pode
    // deixar a tela travada em "carregando" para sempre.
    console.error("Falha ao iniciar a página:", erro);
    mostrarEstadoMapa("erro");
  }
}

document.querySelector("#btn-tentar-novamente")?.addEventListener("click", iniciar);

iniciar();
