# Hotfix v2.3.2 — Build falhando vendo arquivos do frontend

## Problema

```
frontend/src/components/Icon.tsx:39:16 - error TS17004:
Cannot use JSX unless the '--jsx' flag is provided.
```

O `nest build` do backend estava tentando compilar arquivos `.tsx` da
pasta `frontend/` (irma do `backend/`). Isso aconteceu porque o
`tsconfig.json` do backend nao tinha `include` nem `exclude` explicitos,
e em alguns ambientes (como o Render) o TypeScript acabava varrendo
fora do diretorio do backend.

## Correcao (3 arquivos)

### 1. `backend/tsconfig.json`
Adicionados `include` e `exclude` explicitos:
- **include**: so `src/**` e `prisma/seed.ts`
- **exclude**: explicita `../frontend`, `../desktop`, `../docs`

### 2. `backend/tsconfig.build.json` (NOVO — padrao NestJS)
Versao especifica para build de producao, ainda mais restritiva.
Exclui testes, seed, e qualquer coisa fora de `src/`.

### 3. `backend/nest-cli.json`
Agora aponta explicitamente para `tsconfig.build.json`:
```json
{
  "compilerOptions": {
    "tsConfigPath": "tsconfig.build.json",
    "deleteOutDir": true
  }
}
```

## Verificacoes recomendadas no Render

Mesmo com a correcao, vale conferir a configuracao do servico no Render
para garantir que esta apontando corretamente:

1. **Dashboard Render** → `almoxarifado-api` → **Settings**
2. Confira:
   - **Root Directory**: deve estar como `backend`
   - **Build Command**: `npm install && npx prisma generate && npx prisma db push && npm run build`
   - **Start Command**: `node dist/main`
3. Se algum estiver diferente, corrija e clique em **Save Changes**

## Aplicar

```bash
git add backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json
git commit -m "fix(backend): isolar build do backend para nao ver arquivos do frontend"
git push
```

O Render detecta o push e refaz o build sozinho. Deve passar agora.
