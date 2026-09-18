# Formato de `conferencias/<id-da-ligacao>.yaml`

Um arquivo por ligação (mesma regra de "um arquivo por registro" de
`dados/`), gerado e atualizado **só** por `scripts/registrar.js`.

```yaml
ligacao: talmude-confirma-autoria-mosaica
fontes:
  - hash: 3fd3df099b2f          # identifica "esta fonte sustentando esta ligação"
    nivel: 1                    # cópia da fonte no momento da conferência
    descricao: Talmude Babilônico, tratado Bava Batra, fólios 14b–15a
    alegacao: <o que se conferiu que a fonte diz>
    veredito: confirmada        # confirmada | nao_confirmavel | contradiz
    parou_em: null              # existencia_da_obra | localizacao | conteudo | null (só se confirmada)
    conferido_em: <URL ou referência admissível consultada>
    observacao: ''
    data: '2026-09-17'
    conferido_por: contraprova
    revisao_humana: pendente    # pendente | feita — só o usuário muda para feita
```

## O hash

`sha256` de `{tipo da ligação, entre, nivel, descricao}`, com 12 caracteres
(ver `hashFonte` em `scripts/lib-dados.js`). Se qualquer um desses mudar, o
veredito antigo deixa de valer, porque se referia a outra coisa:

- descrição mudou → a fonte aparece como `sem_conferencia` (é outra fonte);
- descrição igual, mas nível, tipo ou pontas mudaram → aparece como
  `desatualizada`.

Mudanças em `notas`, `o_que_derrubaria`, `forca` ou `quem_sustenta`
**não** invalidam o veredito: não mudam o que a fonte precisa dizer.

## Ciclo de vida

- Uma fonte removida da ligação tem o veredito descartado na próxima
  gravação.
- Um veredito refeito que **mudou** volta `revisao_humana` para
  `pendente`. Um que se repetiu mantém a revisão humana anterior.
- A pasta `conferencias/` é versionada: é a trilha de auditoria do projeto.

## Relação com `scripts/conferir_citacoes.js`

O script antigo gera um checklist Markdown descartável
(`docs/checklist_citacoes.md`, ignorado pelo git), que recomeça zerado a
cada execução. `conferencias/` substitui esse papel com estado persistente
por fonte. Isso fecha provisoriamente a decisão em aberto da seção 10 da
arquitetura ("formato exato de `conferir_citacoes.js`"). Se o usuário
aprovar, atualize aquela seção.
