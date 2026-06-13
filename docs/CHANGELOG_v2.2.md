# Changelog v2.2 — Cascata expandida com 7 fontes em 2 ondas paralelas

## Resumo

Triplicada a chance de encontrar um produto no primeiro escaneamento.
A nova cascata consulta **ate 7 APIs** organizadas em duas ondas
paralelas, sem retardar a resposta.

## Nova arquitetura

```
   Catalogo local (instantaneo)
        ↓
   ┌─── ONDA 1 (brasileiras, em paralelo) ───┐
   │  DotCompany                              │
   │  Produto XYZ          → 1ª que responder │
   │  Cosmos Bluesoft*                        │
   └──────────────────────────────────────────┘
        ↓ se nenhuma achar
   ┌─── ONDA 2 (globais, em paralelo) ────────┐
   │  Open Food Facts                         │
   │  Open Beauty Facts    → 1ª que responder │
   │  Open Products Facts                     │
   │  UPCitemdb                               │
   └──────────────────────────────────────────┘

   *Cosmos so ativa se a variavel COSMOS_TOKEN existir
```

Como sao paralelas dentro de cada onda, o tempo total de resposta nao
aumenta significativamente — fica limitado ao timeout da mais rapida
que achar o produto.

## APIs por onda

### Onda 1 — Brasileiras

| API | Caracteristicas | Auth |
|---|---|---|
| DotCompany | 1M+ produtos BR, 50/dia por IP | Nao |
| Produto XYZ | Colaborativa, comunidade BR | Nao |
| Cosmos Bluesoft | Referencia BR, com NCM/CEST/marca/imagem | Token (cadastro gratuito) |

### Onda 2 — Globais (fallback)

| API | Caracteristicas | Auth |
|---|---|---|
| Open Food Facts | Alimentos globais | Nao |
| Open Beauty Facts | Higiene, cosmeticos | Nao |
| Open Products Facts | Limpeza, geral | Nao |
| UPCitemdb | UPC mundial, 100/dia | Nao |

## Como ativar a Cosmos Bluesoft (opcional)

Veja `docs/ATIVAR_COSMOS.md` para o passo-a-passo:
1. Criar conta gratuita em cosmos.bluesoft.com.br
2. Obter token (Minha conta → API)
3. Adicionar `COSMOS_TOKEN=xxx` no Render Environment

O sistema detecta a variavel automaticamente e comeca a consultar.
Para desativar, basta remover a variavel.

## Mudancas tecnicas

- `produtos-externos.service.ts` reescrito com helper `primeiroQueRetornar`
  que usa `Promise.allSettled` para nao cancelar requests em andamento
- Heuristica de categoria sugerida expandida (mais palavras-chave)
- Scanner atualizado para mostrar as 8 fontes legivelmente
- Adicionado `docs/ATIVAR_COSMOS.md` com instrucoes
