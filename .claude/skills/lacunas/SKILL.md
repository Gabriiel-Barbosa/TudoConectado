---
name: lacunas
description: Relatório do que falta no projeto Tudo Conectado — fontes não conferidas, sem localização exata ou contraditas, afirmações sem evidência, capítulos de Gênesis sem passagem, registros isolados — com a recomendação do que atacar primeiro. Use quando o usuário perguntar o que falta, por onde continuar, qual o estado do projeto, ou pedir um diagnóstico dos dados. Só lê; não altera nada.
allowed-tools: Read, Glob, Grep, Bash(node .claude/skills/lacunas/scripts/lacunas.js:*)
---

# /lacunas — o mapa do que ainda não existe

A seção 11 da metodologia pede que o vazio seja **visível**. Esta skill
aplica isso ao próprio projeto: mostra onde a evidência é fraca e o que ainda
não foi mapeado, para decidir o próximo passo com base nos dados, e não na
memória.

## Relatório atual

!`node .claude/skills/lacunas/scripts/lacunas.js`

## O que fazer com o relatório

O relatório acima é **fato computado**. Não o repita inteiro para o
usuário. Seu trabalho é interpretá-lo e priorizar.

### 1. Priorize nesta ordem

1. **Fontes em `contradiz`.** Há uma ligação publicada que a própria
   evidência desmente. Vem antes de tudo.
2. **Fontes sem localização exata.** Violam a regra da seção 5 da
   arquitetura, que `validar.js` ainda não aplica. Cada uma precisa da
   página, fólio, coluna ou nº de catálogo **vindo do usuário ou de consulta
   à obra**, nunca da memória.
3. **Fontes `nao_confirmavel`, `desatualizada` e `sem_conferencia`.**
   Resolvem-se com `/conferir`.
4. **Afirmações sem nenhuma ligação de evidência.** Estão no grafo sem
   sustentação.
5. **Cobertura:** capítulos de Gênesis sem passagem e registros isolados.
6. **Informativo:** não é defeito, mas pode indicar onde aprofundar.

### 2. Diga o que o relatório não sabe

- A detecção de localização exata é **heurística** (procura marcadores
  como "p.", "cap. 3", "14b", "coluna III"). Ao citar esse item, diga que
  falsos positivos e negativos são possíveis. Se uma fonte listada parecer
  ter localização, confira lendo a descrição.
- "Capítulo tocado" não é "capítulo coberto": uma passagem de 3 versículos
  toca o capítulo inteiro para o relatório.
- A seção "Passagens que declaram nenhum paralelo" **não é um defeito**: é o
  vazio declarado, exatamente como a metodologia pede.

### 3. Entregue

```
Estado: <totais em uma linha>

Prioridade agora:
1. <item> — <por que> — <como resolver: skill ou ação do usuário>
2. ...

Depois:
- <itens de cobertura, agrupados>

Nada a fazer:
- <o que está limpo, em uma linha>
```

No máximo cinco itens em "Prioridade agora". Quando o próximo passo for uma
skill (`/conferir <ids>`, `/capturar ligacao ...`), escreva o comando pronto
para o usuário copiar.

### 4. Sugestão de expansão

Se o usuário perguntar "por onde continuar" e a integridade estiver limpa,
a arquitetura (seção 11, item 2) aponta **Gênesis 10** (Tabela das Nações)
como o trecho com mais apoio externo. Sugira começar por ele e diga de onde
vem a sugestão. Não liste povos, fontes ou paralelos de memória: isso é
trabalho de `/capturar` com fontes conferidas.

## Formato bruto

Para os dados em JSON (útil para comparar dois momentos):

```bash
node .claude/skills/lacunas/scripts/lacunas.js --json
```
