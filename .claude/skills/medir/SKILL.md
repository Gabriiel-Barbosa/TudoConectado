---
name: medir
description: Mede em que escala o projeto Tudo Conectado fica lento, com o agente Sismógrafo (grafos sintéticos crescentes numa cópia isolada), e transforma o resultado numa decisão de otimizar agora, depois ou nunca. Também mede o antes e o depois de uma otimização. Use quando o usuário pedir para medir desempenho, testar escala, ou decidir se vale otimizar.
argument-hint: "[escala-alvo em registros, ex.: 2500] [pipeline|interface|tudo] | --comparar <operação>"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep
---

# /medir — otimizar com número, não com palpite

Argumentos: **$ARGUMENTS**

Hoje o grafo tem poucos nós e tudo é instantâneo, então nenhuma
otimização se justifica pela experiência atual. Esta skill responde a
**quando** cada operação vai ficar lenta, para otimizar na hora certa. Quem
mede é o agente `sismografo`, numa cópia descartável. Você interpreta e
recomenda.

## Parâmetros

Interprete `$ARGUMENTS`:

- **escala-alvo**: até quantos registros medir. Se o usuário não disser,
  use **2500** e diga que é uma suposição sua, não uma estimativa do
  tamanho final de Gênesis (ninguém estimou isso ainda). Pergunte se ele
  tem uma meta.
- **foco**: `pipeline` (validar/compilar), `interface` (carga, clique,
  busca, filtro) ou `tudo` (padrão).
- **`--comparar <operação>`**: modo antes/depois, usado ao otimizar algo
  (ver abaixo).

## Fluxo — diagnóstico

### 1. Disparar o Sismógrafo

Chame a ferramenta Agent com `subagent_type: sismografo`:

> "Meça <foco> nas escalas das suas instruções, até <escala-alvo>
> registros (pare antes se uma operação passar de 10 s). Siga o formato de
> resposta das suas instruções."

A medição de interface usa o Chrome e pode demorar. Avise o usuário antes
de disparar.

### 2. Interpretar

Com a tabela em mãos, classifique cada operação:

| situação | decisão |
|---|---|
| ruptura **abaixo** da escala-alvo | **otimizar agora**: o projeto chega lá |
| ruptura **acima**, mas até 2× a escala-alvo | **anotar**: revisar quando os dados crescerem |
| sem ruptura até 2× a escala-alvo | **não otimizar**: seria complexidade sem ganho |

Diferencie o que o Sismógrafo **mediu** do que ele **inferiu** lendo o
código. Uma causa inferida precisa ser confirmada (ver o modo comparar)
antes de se investir numa correção.

### 3. Entregue

```
Escala-alvo: <n> registros (<origem: usuário | suposição>)

Otimizar agora:
- <operação>: ruim a partir de ~<n>. Causa <medida|inferida>: <arquivo:linha>. Correção proposta: <uma frase>.

Anotar para depois:
- <operação>: ruim a partir de ~<n>.

Não mexer:
- <operações que aguentam folgadamente>
```

Não implemente nada neste passo. Proponha e pergunte.

## Fluxo — comparar (antes e depois de uma otimização)

Use quando o usuário aprovar uma otimização:

1. Antes de editar o código, peça ao Sismógrafo para medir **só a
   operação em questão**, **só na escala** em que ela quebrou e em uma
   escala acima: "Meça apenas <operação> nas escalas <n> e <2n>."
2. Implemente a correção na conversa principal. Para a interface, siga
   `.claude/skills/revisar-frontend/convencoes-frontend.md`.
3. Peça a mesma medição de novo.
4. Relate: `<operação> em <n>: <antes> -> <depois> (mediana de 5)`. Se a
   melhora for menor que 30%, diga isso claramente: talvez a causa inferida
   estivesse errada.

## Suspeitas já registradas

O código atual tem dois candidatos conhecidos, **ainda não medidos**:

- `docs/assets/app.js`: `indiceDoNo` percorre todas as arestas e chama
  `noPorId` (busca linear em `grafo.nos`) para cada uma. Roda a cada clique
  num nó.
- `docs/assets/app.js`, em `configurarBusca`: filtra todos os nós a cada
  tecla, sem debounce.

Peça ao Sismógrafo que confirme ou descarte essas suspeitas, mas não as
trate como fato antes da medição.
