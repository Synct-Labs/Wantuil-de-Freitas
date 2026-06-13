# Changelog v2.3.1 — Bug fix critico + UX da unidade

## Corrigido

### Bug: "Ja existe um item com este codigo_interno"

O sistema gerava o codigo interno (WF-00001, WF-00002...) usando
`prisma.item.count() + 1`. Mas isso falhava quando:

- Voce excluia permanentemente um item (`count` diminui mas codigos
  existentes nao mudam)
- Duas criacoes simultaneas calculavam o mesmo numero (race condition)

Exemplo do bug:
- Items existentes: WF-00001, WF-00003
- `count() = 2` → sistema tenta criar `WF-00003` → bate na unique
  constraint → erro

**Correcao:** Em vez de `count()`, agora o sistema busca o **maior
codigo interno existente** e soma 1. Alem disso, faz **ate 5 retries**
em caso de colisao (caso duas criacoes simultaneas conflitem).

```typescript
// ANTES
const count = await this.prisma.item.count();
const codigoInterno = `WF-${String(count + 1).padStart(5, '0')}`;

// AGORA
const ultimo = await this.prisma.item.findFirst({
  where: { codigoInterno: { startsWith: 'WF-' } },
  orderBy: { codigoInterno: 'desc' },
});
const proximo = ultimo ? parseInt(ultimo.codigoInterno.slice(3)) + 1 : 1;
const codigoInterno = `WF-${String(proximo).padStart(5, '0')}`;
// + loop com retry em P2002
```

## Melhorado

### Campo "Unidade" virou dropdown

Confusao reportada: o usuario nao sabia o que era o campo "Unidade".
Estava vazio com placeholder "un (padrao)", e a pessoa digitou "0"
achando que era quantidade.

**Mudanca:** virou um **dropdown** com as opcoes mais comuns para
almoxarifado de doacoes:

- **un** — unidade (cada item inteiro) ← padrao
- **kg** — quilograma
- **g** — grama
- **L** — litro
- **ml** — mililitro
- **pct** — pacote
- **cx** — caixa
- **fd** — fardo
- **par**
- **rolo**
- **dz** — duzia

Adicionada tambem uma **legenda explicativa** abaixo dos campos:

> *"A unidade define como o saldo sera exibido (ex: '12 un' ou
> '30 kg'). O estoque minimo dispara alerta quando o saldo cai a
> esse valor — deixe 0 se nao quiser alerta."*

## Arquivos alterados

- `backend/src/itens/itens.service.ts` — gerador de codigo + retry
- `frontend/src/pages/Itens.tsx` — dropdown de unidade + legenda
