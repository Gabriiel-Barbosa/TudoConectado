---
name: redigir
description: Revisa a redação dos textos do projeto Tudo Conectado — descrições de registros, datações, notas e o_que_derrubaria em dados/ — com o agente Redator, seguindo o guia de estilo do projeto (norma culta, didática, nada de fato novo, nada de plágio). Use quando o usuário pedir para revisar, corrigir, melhorar ou padronizar texto, gramática, redação ou clareza, ou depois de /capturar criar um registro novo.
argument-hint: "[arquivo ou pasta em dados/ ...] [--so-gramatica]"
allowed-tools: Read, Glob, Grep, Bash(npm run validar), Bash(git diff:*), Bash(node .claude/skills/conferir/scripts/pendentes.js:*)
---

# /redigir — texto claro, fiel e com autoria própria

Alvo: **$ARGUMENTS**

A regra de ouro está no [guia-de-estilo.md](guia-de-estilo.md), seção 1:
**reescrever não é acrescentar.** Um texto mais bonito que afirma algo que as
fontes não sustentam é pior do que o texto original.

## Fluxo

```
Redação:
- [ ] 1. Escolher os arquivos
- [ ] 2. Disparar o Redator
- [ ] 3. Revisar o diff
- [ ] 4. Validar e checar conferências
- [ ] 5. Apresentar ao usuário
```

### 1. Escolher os arquivos

- Sem argumentos: todos os YAML de `dados/registros/`, `dados/afirmacoes/`
  e `dados/ligacoes/`.
- Com argumentos: só os arquivos ou pastas indicados.
- `--so-gramatica`: o Redator corrige só a norma (guia, seção 4), sem
  reestruturar frases.

Com mais de 8 arquivos, divida em lotes de até 8, um Redator por lote, todos
na mesma mensagem.

### 2. Disparar o Redator

Use a ferramenta Agent com `subagent_type: redator`. O prompt contém só a
lista de arquivos e o foco, se houver. O Redator lê o guia sozinho.

### 3. Revisar o diff

Rode `git diff -- dados/` e confira cada mudança contra o guia, seção 1:

- Apareceu algum número, data, nome ou qualificador que não existia antes?
  **Desfaça essa mudança** (Edit de volta ao texto anterior) e registre no
  relatório.
- Algum campo proibido mudou (guia, seção 6)? Desfaça.
- Alguma atribuição ("segundo X") sumiu? Desfaça.

Você é a segunda barreira. O Redator é a primeira.

### 4. Validar e checar conferências

```bash
npm run validar
node .claude/skills/conferir/scripts/pendentes.js
```

Se alguma ligação aparecer como `desatualizada` por causa da redação, diga ao
usuário e sugira `/conferir <ids>`.

### 5. Apresentar

```
Revisados: <n> arquivo(s)
Mudanças: <arquivo — campo — resumo em uma linha>
Desfeitas na revisão: <o quê e por quê>
Sugestões do Redator (não aplicadas): <lista>
Validação: <resultado>
Próximo passo: <commit, /conferir, ou nada>
```

Não faça commit. O usuário lê o diff e decide.

## O que esta skill nunca faz

- Nunca altera `fontes`, `id` ou o `texto` de uma Afirmação.
- Nunca aceita uma reescrita que acrescente fato.
- Nunca usa texto da web como base de redação.
