---
name: revisar-frontend
description: Revisa a interface do projeto Tudo Conectado (docs/) em navegador real com o agente Vitrine, prioriza os problemas com o usuário e corrige um por vez em app.js, estilo.css e index.html, seguindo as convenções do projeto, com nova verificação da Vitrine depois de cada lote. Use quando o usuário pedir para revisar, testar ou melhorar a interface, o site, o mapa, o layout ou a versão de celular.
argument-hint: "[foco opcional: celular | busca | filtros | dossiê | acessibilidade | <descrição de um problema>]"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node --check docs/assets/app.js), Bash(npm test)
---

# /revisar-frontend — ver, priorizar, corrigir, ver de novo

Foco pedido: **$ARGUMENTS**

A regra desta skill: **ninguém corrige o que ninguém viu.** A Vitrine usa o
site num Chrome real e relata os problemas com a forma de reproduzir. Você
corrige aqui, na conversa principal, onde o usuário acompanha. Depois a
Vitrine confere de novo.

## Antes de mexer em qualquer código

Leia [convencoes-frontend.md](convencoes-frontend.md). Ele lista as
convenções do projeto e os bugs que já aconteceram, com o commit que os
corrigiu. Boa parte dos problemas de interface deste projeto são
reincidências.

## Fluxo

```
Revisão:
- [ ] 1. Vitrine: diagnóstico
- [ ] 2. Triagem com o usuário
- [ ] 3. Correções, uma por vez
- [ ] 4. Checagens locais
- [ ] 5. Vitrine: verificação dirigida
- [ ] 6. Resumo
```

### 1. Diagnóstico

Chame a ferramenta Agent com `subagent_type: vitrine`:

- **sem foco**: "Execute o roteiro mínimo completo das suas instruções e
  depois explore livremente."
- **com foco** (`$ARGUMENTS`): "Execute os passos 1 e 2 do roteiro mínimo
  para garantir que o site carrega. Depois concentre-se em: <foco>."

Se `docs/grafo.json` não existir, a Vitrine só vai ver o estado vazio.
Nesse caso, avise o usuário e sugira `npm run compilar`, sem rodá-lo você
mesmo.

### 2. Triagem

Apresente os problemas agrupados por gravidade (**quebra** → **confunde**
→ **estética**), com uma linha cada e a origem provável. Recomende a ordem
(quebras primeiro) e pergunte ao usuário quais corrigir agora. Não corrija
tudo automaticamente: estética é gosto, e o usuário decide.

Problemas que tocam a **apresentação da evidência** (força, fontes,
`o_que_derrubaria`, "nenhum paralelo conhecido" escondidos, truncados ou
ambíguos) são sempre pelo menos **confunde**, mesmo que a Vitrine os tenha
classificado como estética. Neste projeto, a evidência é o produto.

### 3. Corrigir

Para cada problema aprovado:

1. Leia o trecho apontado e **confirme a causa no código** antes de
   editar. A origem da Vitrine é "provável", não garantida.
2. Faça a **menor correção que resolve a causa**, não o sintoma. Se a causa
   for estrutural (ex.: dois estados que podem ficar visíveis ao mesmo
   tempo), prefira a correção que torna o erro impossível, como no commit
   `8fde8b8`.
3. Mantenha o estilo do arquivo: nomes em português, comentários que
   explicam o **porquê** (como os existentes) e nenhum framework ou lib
   nova.
4. Diga ao usuário em uma frase o que mudou e por quê.

Corrigir um problema não autoriza refatorar o arquivo. Se houver algo que
mereça refatoração, anote para o resumo.

### 4. Checagens locais

```bash
node --check docs/assets/app.js
npm test
```

O `npm test` cobre só os scripts Node, não a interface, mas garante que
nada fora de `docs/` quebrou.

### 5. Verificação dirigida

Chame a Vitrine de novo com **só** os passos de reprodução dos problemas
corrigidos, mais o passo 1 do roteiro mínimo (carga sem erro no console):

> "Verifique se estes problemas foram resolvidos, reproduzindo exatamente
> estes passos: <lista>. Rode também o passo 1 do roteiro mínimo. Relate
> apenas: resolvido / não resolvido / regressão nova."

O navegador pode estar com CSS ou JS antigos em cache. O servidor da
Vitrine manda `no-store`, mas se o resultado parecer inalterado, peça a ela
um recarregamento forçado antes de concluir que a correção falhou.

Se algo não foi resolvido, volte ao passo 3 para esse item. No máximo duas
voltas por problema: na terceira, pare e relate ao usuário o que foi
tentado.

### 6. Resumo

```
Corrigidos: <n> — <lista curta, com arquivo:linha>
Não corrigidos (escolha do usuário): <lista>
Não resolvidos após 2 tentativas: <lista com o que foi tentado>
Anotado para depois: <refatorações ou melhorias vistas no caminho>
Próximo passo: /publicar (incrementa o ?v= de cache automaticamente)
```

Não incremente o `?v=` em `index.html` aqui. O `/publicar` faz isso uma
vez, no momento do commit.
