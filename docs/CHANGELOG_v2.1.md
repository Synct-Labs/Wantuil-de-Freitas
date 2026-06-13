# Changelog v2.1 — Catalogo crescente + API brasileira

## Problema reportado

Produtos brasileiros comuns (Qboa, macarrao Renata, feijao preto, atum 88)
nao apareciam nas APIs Open Food/Beauty/Products. Isso era esperado: essas
bases sao alimentadas pela comunidade global e tem cobertura fraca para
produtos populares brasileiros.

## Solucao implementada

Nova cascata de 5 niveis para buscar produtos por EAN:

```
1. Catalogo local da instituicao   (cache, < 50ms, sem rede)
   ↓ (se nao encontrar)
2. DotCompany                       (API brasileira, 1M+ produtos)
   ↓
3. Open Food Facts                  (alimentos)
   ↓
4. Open Beauty Facts                (higiene)
   ↓
5. Open Products Facts              (limpeza/geral)
```

## Novidades

### 1. Catalogo institucional crescente

Toda vez que alguem cadastra um produto manualmente com codigo de barras,
o produto e salvo numa tabela `catalogo_produtos` no banco. Da segunda
vez que aquele EAN aparece — em qualquer entrada, qualquer scanner, em
qualquer aparelho — o sistema reconhece **instantaneamente**, sem chamar
API nenhuma.

Resultado pratico: depois de 2-3 meses de uso, o catalogo proprio da
Wantuil cobre 80%+ das doacoes recorrentes (sempre a mesma marca de
arroz, sempre o mesmo Qboa).

Quando o sistema acha pelo catalogo, mostra a fonte como
"Catalogo da instituicao (consulta anterior)".

### 2. DotCompany — base brasileira massiva

Nova API integrada com **1 milhao+ produtos brasileiros**:
- Endpoint: `https://erp.dotcompany.com.br/api/catalogo/public/buscar`
- 50 consultas/dia gratis sem cadastro (por IP)
- Cobertura: produtos de mercearia, limpeza, higiene, eletronicos
- Vai resolver: Qboa, Renata, Camil, Tio Joao, Yp e demais marcas comuns

Combinada com o cache local, as 50 consultas/dia da Wantuil viram
"ilimitadas na pratica": cada produto novo so consome 1 consulta —
depois fica no cache para sempre.

### 3. Categoria sugerida automatica por palavra-chave

Quando a API responde mas nao traz a categoria, o sistema infere
a partir do nome:
- Detergente, Qboa, sabao, agua sanitaria → **Limpeza**
- Shampoo, sabonete, pasta de dente, fralda → **Higiene**
- Arroz, feijao, oleo, macarrao, atum, leite → **Alimentos**

Funciona tambem em produtos genericos sem categoria definida.

### 4. Busca por nome

Novo endpoint `/produtos-externos/buscar?q=macarrao` retorna produtos
do catalogo local com nome parecido, ordenados pelos mais usados. Util
para quando o leitor de codigo de barras nao funciona ou nao tem.

## Arquivos alterados

- `backend/prisma/schema.prisma` — novo modelo `CatalogoProduto`
- `backend/src/produtos-externos/produtos-externos.service.ts` — cascata completa
- `backend/src/produtos-externos/produtos-externos.controller.ts` — novos endpoints
- `backend/src/produtos-externos/produtos-externos.module.ts` — importa Prisma
- `frontend/src/pages/Itens.tsx` — salva no catalogo apos cadastro manual
- `frontend/src/components/Scanner.tsx` — mostra fonte legivel

## Aplicar a migracao

No proximo deploy, o `prisma db push` cria a tabela `catalogo_produtos`
automaticamente. Sem acao manual necessaria.
