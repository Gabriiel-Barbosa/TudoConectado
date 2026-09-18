---
name: conferir
description: Confere as fontes das ligações do projeto Tudo Conectado com o agente Contraprova (verificação adversarial, em paralelo) e grava os vereditos em conferencias/. Use quando o usuário pedir para conferir, verificar ou checar fontes ou citações, depois de criar uma ligação com /capturar, ou quando /lacunas ou /publicar apontarem fontes sem conferência ou desatualizadas.
argument-hint: "[id-da-ligacao ...] [--refazer]"
allowed-tools: Read, Glob, Grep, Write, Bash(node .claude/skills/conferir/scripts/pendentes.js:*), Bash(node .claude/skills/conferir/scripts/registrar.js:*)
---

# /conferir — toda fonte passa pela Contraprova

Argumentos: **$ARGUMENTS**

O `validar.js` confere a **forma** de uma fonte. Esta skill confere o
**conteúdo**: se a obra existe, se a localização existe e se ela diz o que
se alega. Quem julga é o agente `contraprova`, que roda isolado e **sem ver
o raciocínio** de quem propôs a ligação. Esse isolamento é o que torna a
conferência independente. Não o quebre.

Os vereditos ficam em `conferencias/<id-da-ligacao>.yaml`, fora de
`dados/` (não afetam `validar.js` nem o grafo). O formato está em
[formato-conferencia.md](formato-conferencia.md).

## Fluxo

```
Conferência:
- [ ] 1. Listar pendências (pendentes.js)
- [ ] 2. Redigir a alegação de cada fonte
- [ ] 3. Disparar a Contraprova em paralelo
- [ ] 4. Gravar vereditos (registrar.js)
- [ ] 5. Relatar e encaminhar o que não foi confirmado
```

### 1. Listar pendências

- Sem argumentos: todas as ligações.
- Com IDs: só as ligações indicadas.
- Com `--refazer`: inclui fontes já confirmadas.

```bash
node .claude/skills/conferir/scripts/pendentes.js [ids...] [--incluir-confirmadas]
```

A saída é JSON, um item por ligação, com `tipo`, `pontas` (nome ou texto de
cada ponta) e as fontes pendentes (`hash`, `nivel`, `descricao`,
`situacao`). Se a lista vier vazia, diga que está tudo conferido e pare.

Situações: `sem_conferencia` (nunca conferida), `desatualizada` (conferida,
mas a ligação mudou depois), `nao_confirmavel`, `contradiz`.

### 2. Redigir a alegação

Para cada fonte, escreva em **uma frase** o que ela precisa dizer para
sustentar a ligação. Use **somente** `tipo` e `pontas` da saída do script:

| tipo | alegação (forma) |
|---|---|
| `confirma` | "<fonte> registra/atesta que <texto da afirmação ou relação entre as pontas>" |
| `contradiz` | "<fonte> sustenta que <o contrário da afirmação>, com base em <tipo de apoio>" |
| `foi_copiado_de` | uma alegação para cada uma das três condições que a fonte sustenta |

Proibido: ler `notas` ou `o_que_derrubaria` do YAML para compor a
alegação, e acrescentar à alegação argumentos a favor. A Contraprova precisa
receber a alegação mais seca possível.

### 3. Disparar a Contraprova

Use a ferramenta Agent com `subagent_type: contraprova`, **um agente por
ligação**, todos na **mesma mensagem** para rodarem em paralelo. Com mais
de 6 ligações, faça lotes de 6. Ligações pequenas que usam a mesma obra
(por exemplo, várias notas textuais citando o mesmo comentário) podem ir
juntas num agente só: ler o livro uma vez custa menos que ler seis vezes.

**Modelo:** a Contraprova roda em Sonnet por padrão (ver o arquivo do
agente). Antes de relatar um veredito `contradiz`, ou um `nao_confirmavel`
com `parou_em: conteudo`, confira aquela fonte de novo com
`model: "opus"` na chamada do Agent, com o mesmo prompt. Esses são os
vereditos que mudam os dados, e é neles que vale o modelo mais forte. Se as
duas rodadas discordarem, grave o veredito do Opus e relate a divergência.

O prompt de cada agente contém só isto:

```
Confira as fontes abaixo. Para cada uma, devolva o bloco no formato das suas instruções,
incluindo uma linha "hash: <hash>" copiada exatamente como está aqui.

Ligação: <id>
1. hash: <hash>
   fonte (nível <n>): <descricao>
   alegação: <sua frase do passo 2>
2. ...
```

Não inclua o caminho do arquivo, as notas, o `o_que_derrubaria`, a sua
opinião nem o histórico da conversa.

### 4. Gravar os vereditos

Converta as respostas num JSON (no diretório de rascunho da sessão, nunca
no repositório):

```json
[{ "ligacao": "<id>",
   "fontes": [{ "hash": "...", "alegacao": "...", "veredito": "confirmada",
                "parou_em": null, "conferido_em": "<url/referência>", "observacao": "" }] }]
```

Mapeie `parou em` da Contraprova para `parou_em`: "existência da obra" →
`existencia_da_obra`, "localização" → `localizacao`, "conteúdo" →
`conteudo`, "nenhuma" → `null`.

```bash
node .claude/skills/conferir/scripts/registrar.js <caminho-do-json>
```

O script **recusa tudo** se algum hash não corresponder à fonte atual (ou
seja, se a fonte mudou no meio do caminho), se o veredito for inválido ou se
uma `confirmada` vier sem `conferido_em`. Se recusar, corrija o JSON. Nunca
edite `conferencias/*.yaml` à mão para contornar a recusa.

**Transcreva os vereditos sem mudá-los.** Se você discordar de um veredito
da Contraprova, grave o dela e registre a discordância no relatório ao
usuário.

### 5. Relatar

```
| ligação | fonte | veredito | parou em | observação |
|---|---|---|---|---|
```

Depois da tabela:

- **`contradiz`**: mostre a evidência que a Contraprova encontrou. Não edite
  a ligação. Proponha as opções (corrigir a localização, corrigir a
  alegação, remover a fonte, descartar a ligação) e deixe o usuário decidir.
- **`nao_confirmavel`**: diga o que faltou (`parou_em`) e o que resolveria,
  como uma página precisa ou o acesso a uma edição específica.
- **`confirmada`**: lembre que o veredito é de um agente. O campo
  `revisao_humana` fica `pendente` até o usuário conferir pessoalmente e
  mudá-lo para `feita`.

## O que esta skill nunca faz

- Nunca edita arquivos em `dados/`.
- Nunca grava um veredito que a Contraprova não deu.
- Nunca marca `revisao_humana: feita`, que só o usuário marca.
