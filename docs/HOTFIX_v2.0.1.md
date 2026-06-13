# Hotfix v2.0.1 — Correção do build no Render

## Problema

Build no Render falhou com erro TypeScript:

```
src/produtos-externos/produtos-externos.controller.ts:11:9 - error TS4053:
Return type of public method from exported class has or is using name
'ProdutoEncontrado' from external module ... but cannot be named.
```

## Causa

O `tsconfig.json` do backend tinha `"declaration": true`, fazendo o TypeScript
gerar arquivos `.d.ts` (declarações de tipo). Quando faz isso, ele exige que
todos os tipos retornados por métodos públicos sejam exportados — para que
possam aparecer no `.d.ts`.

A interface `ProdutoEncontrado` no `produtos-externos.service.ts` não estava
exportada (foi declarada como `interface` simples), e o controller a usava
indiretamente como tipo de retorno.

## Correção

Duas mudanças complementares, no commit deste hotfix:

1. **`backend/tsconfig.json`**: `"declaration": true` → `"declaration": false`
   - O projeto não publica como biblioteca npm, não precisa gerar `.d.ts`
   - Build fica mais rápido também
2. **`backend/src/produtos-externos/produtos-externos.service.ts`**:
   `interface ProdutoEncontrado` → `export interface ProdutoEncontrado`
3. **`backend/src/movimentacoes/movimentacoes.service.ts`**: idem para `ItemMov`
   (não estava quebrando, mas é boa prática para evitar problemas futuros)

## Como aplicar

Basta sobrescrever os arquivos com os do zip v2.0.1 e fazer `git push`.
O Render reinicia o build automaticamente.
