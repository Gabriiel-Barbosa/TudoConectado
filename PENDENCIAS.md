# Pendências

O que ficou por resolver, para não se perder entre um capítulo e outro.
Quando um item sair, apagar a linha.

## Fontes não confirmadas (de capítulos anteriores)

`node .claude/skills/conferir/scripts/pendentes.js` lista o estado atual.
Hoje, cinco fontes seguem `nao_confirmavel`, nenhuma delas de Gênesis 4:

- `6qpaleogen-confirma-genesis` — 1 fonte
- `hipotese-documentaria-contradiz-autoria-mosaica` — 2 fontes
- `talmude-confirma-autoria-mosaica` — 1 fonte
- `textos-das-piramides-e-dos-sarcofagos-paralelo-genesis` — 1 fonte
- `gn01-lugar-ou-ajuntamento` — 1 fonte

Antes de descartar qualquer uma delas, tentar a conferência pela imagem da
página (ver a seção abaixo sobre OCR) — foi o que salvou Skinner p. 107 em
Gênesis 4.

## Gênesis 4

- **Peshitta e Vulgata em Gn 4:8** (`gn04-vamos-ao-campo`): que as duas trazem
  o acréscimo está confirmado por três fontes, mas a redação exata em siríaco
  e a da Vulgata antiga (Jerônimo, não a Nova Vulgata de 1986) não foram
  lidas em edição crítica. Falta o texto siríaco e uma Weber-Gryson ou
  Clementina.
- **Pentateuco Samaritano em Gn 4:8**: a edição de von Gall (1918) foi
  removida da nota porque o OCR do hebraico é ilegível e não há como
  confirmar a página. Se aparecer fac-símile legível, vale reincluir.
- **Reis (2002) e Jacobson (2005)**, que negam haver lacuna em Gn 4:8: entram
  como German (2014) os cita. Os artigos originais não foram lidos.
- **Mowinckel (1937) e Cassuto (1967)** em `gn04-invocar-o-nome`: entram como
  Glisson os cita. Originais não lidos.
- **Listas de apkallu** (Reiner 1961, van Dijk 1962), citadas na nota de
  `historia-fenicia-de-filo-de-biblos-paralelo-genesis`: conhecidas só através
  de Westermann. Sem edição acadêmica aberta localizada.
- **Lohr (2009)**, em ZAW 121, pp. 101-103, sobre o sinal de Caim: seria boa
  segunda fonte para `gn04-o-sinal-de-caim`, mas a cópia aberta está atrás de
  Cloudflare e a do editor é paga.
- **Glisson**: a citação diz p. 137; para precisão máxima seria pp. 136-137.
  Mudar a descrição muda o hash e exige reconferência.
- **Milin Havivin** (fonte de Levine, nível 3): periódico ligado a escola
  rabínica, sem confirmação de revisão formal por pares. Decidido manter em
  nível 3 por ora; rever quando `METODOLOGIA.md` definir os níveis.

## Fontes sem URL, de propósito

Westermann (1984) e o *Dictionary of Deities and Demons in the Bible* (1999)
entram só pela referência impressa. As cópias encontradas no Internet Archive
são uploads de usuário de obras ainda sob direitos (SPCK/Augsburg e Brill), e
linká-las no site publicado seria distribuir cópia não autorizada.

## Armadilhas já encontradas em conferência

- Os metadados do Internet Archive podem dar a edição errada. O Gunkel
  catalogado como 1902 é a 5ª impressão, de 1922, inalterada em relação à 3ª
  de 1910. **A folha de rosto manda, não o catálogo.**
- Um volume pode ter duas páginas com o mesmo número romano. Skinner tem uma
  p. xiii na Introdução (folha 47) e outra na lista de abreviaturas (folha
  27), que é a citada nas notas.
- Quando o OCR corrompe o trecho decisivo, conferir na imagem:
  `<id>_scandata.xml` mapeia folha → página impressa, e
  `https://archive.org/download/<id>/page/leaf<N>_w1600.jpg` traz a imagem.

## Interface

- O `?v=` de `docs/index.html` ainda sobe à mão a cada mudança em
  `assets/`. Está em `v=14`.
- `METODOLOGIA.md` continua por preencher — é o que trava a definição dos
  níveis de fonte e das leituras religiosas.
