---
name: publicar
description: Ritual de pré-commit do projeto Tudo Conectado — testes, validação, trava de conferência das fontes, compilação do grafo, cache-bust de docs/assets e commit com arquivos nomeados um a um. Use só quando o usuário pedir para publicar ou commitar.
argument-hint: "[mensagem do commit, opcional]"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(npm test), Bash(npm run validar), Bash(npm run compilar), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(diff METODOLOGIA.md claude/metodologia.md), Bash(node .claude/skills/publicar/scripts/*), Bash(node .claude/skills/conferir/scripts/pendentes.js:*)
---

# /publicar — nada chega a main sem passar por aqui

Mensagem sugerida pelo usuário: **$ARGUMENTS**

O `publicar.yml` recompila e publica tudo o que chega em `main`, então um
commit com erro vai direto ao ar. Esta skill roda localmente o que o CI roda
e mais três travas que o CI não tem: conferência das fontes, coerência do
cache-bust e revisão do diff do grafo.

## Estado atual

Branch e mudanças:
!`git status --short --branch`

## Fluxo

Execute na ordem. **Qualquer ✋ interrompe o fluxo**: relate e pare.

```
Publicação:
- [ ] 1. Escopo do commit definido
- [ ] 2. npm test
- [ ] 3. npm run validar
- [ ] 4. Espelho da metodologia
- [ ] 5. Trava de conferência (ligações alteradas)
- [ ] 6. npm run compilar + revisão do diff do grafo
- [ ] 7. Cache-bust de docs/assets
- [ ] 8. Stage explícito + mensagem
- [ ] 9. Commit (após confirmação)
- [ ] 10. Push (só se pedido)
```

### 1. Escopo

Pelo `git status` acima, agrupe as mudanças por assunto (dados, scripts,
interface, skills/agentes). Se houver **assuntos não relacionados**,
proponha commits separados, um por assunto, como no histórico do projeto,
e pergunte ao usuário. Se houver algo inesperado (arquivo que ninguém
mencionou), pergunte antes de incluir.

### 2–4. Checagens do CI

```bash
npm test
npm run validar
diff METODOLOGIA.md claude/metodologia.md
```

✋ Se qualquer um falhar, mostre a saída e pare. Não corrija aqui: a
correção é outra tarefa, e o usuário decide se quer fazê-la agora.

### 5. Trava de conferência

Liste as ligações novas ou alteradas:

```bash
git status --short -- dados/ligacoes
```

Para cada ligação nova ou alterada, veja a situação das fontes:

```bash
node .claude/skills/conferir/scripts/pendentes.js <ids...> --resumo
node .claude/skills/conferir/scripts/pendentes.js <ids...>
```

- ✋ **Alguma `contradiz`**: bloqueio sem exceção. A ligação não entra
  neste commit. Ofereça tirá-la do stage e seguir com o resto.
- ✋ **Alguma `sem_conferencia` ou `desatualizada`**: ofereça rodar
  `/conferir <ids>` agora.
- **Alguma `nao_confirmavel`**: pergunte se o usuário quer publicar mesmo
  assim. Só siga com um "sim" explícito, e nesse caso acrescente ao corpo do
  commit: `Fontes pendentes de conferência: <ligação> (<fonte>)`.
- Ligações que não foram tocadas neste commit não bloqueiam. Mencione-as
  numa linha, se houver.

### 6. Compilar e revisar o grafo

```bash
npm run compilar
node .claude/skills/publicar/scripts/diff-grafo.js
```

Confira que o diff do grafo corresponde às mudanças em `dados/`: cada
arquivo novo vira nó ou aresta, e nada some sem que um arquivo tenha sido
removido. ✋ Se aparecer mudança que nenhum arquivo em `dados/` explica,
pare e relate.

`docs/grafo.json` e `docs/timeline.json` **só** mudam por esse comando. Se
o `git status` inicial já os mostrava modificados, é porque foram
compilados antes. O comando os regenera de qualquer forma.

### 7. Cache-bust

```bash
node .claude/skills/publicar/scripts/versao-assets.js --se-mudou
node .claude/skills/publicar/scripts/versao-assets.js --verificar
```

O primeiro incrementa o `?v=` de `estilo.css` **e** de `app.js` juntos, só
se `docs/assets/` mudou desde o último commit e a versão ainda não foi
incrementada. Rodar de novo não incrementa duas vezes. O segundo garante que
as duas referências estão iguais.

### 8. Stage e mensagem

**Nunca** use `git add -A`, `git add .` nem `git commit -a`. Adicione cada
arquivo pelo caminho, incluindo `docs/grafo.json`, `docs/timeline.json` e
`docs/index.html` quando mudarem nas etapas 6–7, além de
`conferencias/*.yaml` das ligações publicadas.

Mensagem no padrão do histórico (`git log --oneline -10`): prefixo
convencional em português (`feat:`, `fix:`, `style:`, `docs:`, `test:`,
`chore:`), frase curta no imperativo sobre **o que muda para quem usa**, e
corpo opcional com o porquê. Se `$ARGUMENTS` trouxe uma mensagem, use-a como
base. Inclua as linhas de atribuição de co-autoria exigidas pelo ambiente,
se houver.

Mostre ao usuário a lista de arquivos do stage (`git diff --cached --stat`)
e a mensagem. **Pergunte antes de commitar.**

### 9. Commit

Após o "sim": `git commit`. Nunca use `--no-verify` nem `--amend` em commit
já existente. Se um hook falhar, relate a saída e corrija a causa, sem
contornar.

### 10. Push

Não faça push por conta própria. Diga que o commit está pronto e que, ao
chegar em `main`, o `publicar.yml` recompila e o GitHub Pages publica.
Pergunte se o usuário quer o push. O projeto hoje commita direto em `main`.
Se o usuário preferir revisão, ofereça criar uma branch e abrir um PR com
`gh pr create`, o que também dispara o `validar.yml`.

## Resumo final

```
Commit: <hash curto> <mensagem>
Arquivos: <n> (<lista curta>)
Grafo: <nós antes -> depois>, <arestas antes -> depois>
Cache-bust: ?v=<n> (<incrementado | mantido>)
Pendências registradas: <fontes nao_confirmavel publicadas, se houver>
Push: <feito | aguardando o usuário>
```
