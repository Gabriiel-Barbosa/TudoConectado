---
name: capturar
description: Cria um Registro, Afirmação, Ligação ou Passagem novo em dados/ do projeto Tudo Conectado, campo a campo e na ordem do schema, com checagem de ID, validação (npm run validar) e conferência das fontes pela Contraprova antes de liberar para commit. Use quando o usuário pedir para adicionar, registrar, cadastrar ou mapear uma pessoa, lugar, acontecimento, texto, objeto, afirmação, ligação, paralelo ou passagem de Gênesis.
argument-hint: "[registro|afirmacao|ligacao|passagem] [o que capturar, em texto livre]"
allowed-tools: Read, Glob, Grep, Bash(npm run validar), Bash(node .claude/skills/capturar/scripts/checar-id.js:*), Bash(node .claude/skills/conferir/scripts/pendentes.js:*)
---

# /capturar — entrada de dados com trava contra fonte inventada

Pedido do usuário: **$ARGUMENTS**

Esta skill escreve em `dados/`, a fonte da verdade do projeto. O risco que
ela existe para conter não é erro de formato (o schema pega), é **conteúdo
sem fonte real**. Por isso ela é lenta de propósito: cada fato vem de alguém
que o sustenta, e cada fonte passa pela Contraprova antes do commit.

## Regras invioláveis

1. **Você nunca é a fonte de um fato.** Fonte, localização exata (página,
   capítulo:versículo, coluna/linha, fólio, nº de catálogo), nome e ano em
   `quem_sustenta`, e faixa de datação vêm do usuário ou de uma obra que foi
   conferida. Se você sugerir uma fonte de memória, apresente-a como
   **"sugestão não verificada"**. Ela passa pela Contraprova exatamente como
   qualquer outra, e nunca é gravada com localização que você não conferiu.
2. **Localização desconhecida não é preenchida.** Se ninguém sabe a página,
   a fonte não entra. Nunca escreva "p. ?", uma página aproximada ou só o
   título da obra. Registre a pendência no resumo final.
3. **IDs são permanentes.** Nunca renomeie nem reaproveite um ID existente.
   Se um nome mudar, mude `nome`/`alias`.
4. **Um arquivo por registro**, nomeado `<id>.yaml`, na pasta da categoria.
5. **Nada é commitado aqui.** A skill termina com o arquivo no working tree
   e validado. O commit é feito pelo `/publicar`.
6. **Nunca edite** `docs/grafo.json` nem `docs/timeline.json`.

## Antes de começar

- Leia `METODOLOGIA.md`. **Se ainda for o placeholder** ("Pendente: este
  arquivo ainda não foi preenchido"), avise o usuário em uma frase: as regras
  de tipos de ligação, níveis de fonte e força de evidência ainda não estão
  escritas, então a captura segue só o schema e a arquitetura. Nunca invente
  o conteúdo de uma seção da metodologia.
- Leia o schema da categoria em `schema/<categoria>.schema.json`.
- Consulte o guia de campos: [guia-campos.md](guia-campos.md). Para
  ligações, consulte também [guia-ligacao.md](guia-ligacao.md).

## Ordem de dependência

Uma Ligação referencia Registros e Afirmações, e uma Passagem referencia
os três. Se o pedido envolve algo que ainda não existe, capture de baixo
para cima:

```
Registro  →  Afirmação  →  Ligação  →  Passagem
```

Antes de criar qualquer coisa, procure com `Grep` em `dados/` se o
registro/afirmação já existe, por nome **e** por alias (ex.: "Senaqueribe"
e "Sennacherib"). Duplicar uma entidade com outro ID parte o grafo em dois.

## Fluxo

Copie este checklist e marque cada passo conforme avança:

```
Captura:
- [ ] 1. Categoria e dependências identificadas (o que já existe, o que falta)
- [ ] 2. Campos coletados — cada fato com origem declarada
- [ ] 3. ID checado com checar-id.js
- [ ] 4. Arquivo escrito a partir do modelo
- [ ] 5. npm run validar passou
- [ ] 6. (ligações) Fontes conferidas pela Contraprova via /conferir
- [ ] 7. Resumo entregue ao usuário
```

### 1. Categoria

Se `$ARGUMENTS` não deixar a categoria clara, decida pelo conteúdo:

| O usuário quer registrar... | Categoria | Pasta |
|---|---|---|
| uma entidade (pessoa, lugar, acontecimento, texto, objeto) | `registro` | `dados/registros/<tipo>/` |
| uma frase que pode ser verdadeira ou falsa, com data | `afirmacao` | `dados/afirmacoes/` |
| que A confirma, contradiz ou foi copiado de B, com evidência | `ligacao` | `dados/ligacoes/` |
| um trecho de Gênesis e o que ele diz | `passagem` | `dados/passagens/genesis/` |

Pergunte só se duas leituras levarem a arquivos diferentes.

### 2. Campos

Siga a ordem do schema. Para cada campo, o [guia-campos.md](guia-campos.md)
diz **quem pode fornecê-lo**: o usuário, você (redação e estrutura) ou uma
fonte conferida. Colete o que faltar em **uma** pergunta agrupada, não uma
pergunta por campo.

Para ligações, leia agora [guia-ligacao.md](guia-ligacao.md). Ele cobre
tipo, força, nível das fontes, `o_que_derrubaria` e as três condições de
`foi_copiado_de`.

### 3. ID

```bash
node .claude/skills/capturar/scripts/checar-id.js <categoria> --sugerir "<nome>"
node .claude/skills/capturar/scripts/checar-id.js <categoria> <id-final>
```

O script lê o padrão direto do schema e procura o ID em **todas** as
categorias, porque elas compartilham o mesmo espaço de IDs no grafo. Só
avance com saída "está livre e válido". Mostre o ID ao usuário antes de
gravar: depois de commitado, ele é permanente.

Convenções de ID de ligação usadas no projeto: `<a>-<tipo>-<b>`, ex.:
`talmude-confirma-autoria-mosaica`,
`hipotese-documentaria-contradiz-autoria-mosaica`.

### 4. Escrever

Parta do modelo da categoria em [modelos/](modelos/) e apague os
comentários de instrução. Use `>` para textos longos em YAML, como nos
arquivos existentes. O arquivo vai para
`dados/<pasta>/<id>.yaml`.

### 5. Validar

```bash
npm run validar
```

Se falhar, corrija **só** o arquivo que você criou e rode de novo. Se o erro
apontar outro arquivo, pare e avise: não é escopo desta captura. Repita até
passar.

### 6. Conferência (obrigatória para ligações)

Invoque a skill `/conferir` passando o ID da ligação nova. Ela entrega as
fontes à Contraprova e grava os vereditos em `conferencias/`.

- **Todas `confirmada`**: siga para o resumo.
- **Alguma `nao_confirmavel`**: mostre o que faltou, conforme o campo
  `parou_em`. Peça ao usuário uma localização mais precisa ou outra fonte.
  Não troque a fonte por conta própria.
- **Alguma `contradiz`**: mostre a evidência da Contraprova. A ligação
  **não** segue para commit até o usuário decidir entre corrigir a fonte,
  corrigir a alegação ou descartar a ligação.

O `/publicar` bloqueia ligações com fonte em `contradiz` e pede confirmação
explícita para `nao_confirmavel`.

### 7. Resumo

Entregue ao usuário:

```
Criado: dados/<pasta>/<id>.yaml
Validação: ok
Conferência: X confirmada(s), Y não confirmável(is), Z contradiz(em)   ← só ligações
Pendências: <fontes sem localização, sugestões não verificadas, campos que o usuário ficou de trazer>
Próximo passo: /publicar quando quiser commitar
```

Se a captura gerou dependências (ex.: criou dois registros antes da
ligação), liste todos os arquivos criados.
