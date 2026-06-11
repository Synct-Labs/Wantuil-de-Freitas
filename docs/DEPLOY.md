# Guia de Deploy em Produção

Este documento descreve como colocar o sistema no ar usando serviços gratuitos.

## 1. Banco de Dados — Supabase

1. Crie uma conta em https://supabase.com
2. Crie um novo projeto (região São Paulo)
3. Vá em **Settings > Database > Connection String**
4. Copie a string de conexão (Pooler para `DATABASE_URL`, Direct para `DIRECT_URL`)
5. Substitua `[SENHA]` pela senha que você definiu

## 2. E-mail — Resend (opcional)

1. Crie conta em https://resend.com
2. Verifique o domínio ou use o sandbox `onboarding@resend.dev`
3. Copie a API Key em **API Keys**

## 3. Backend — Render

1. Crie conta em https://render.com
2. **New > Web Service** > conecte seu repositório
3. **Root Directory:** `backend`
4. **Build Command:** `npm install && npx prisma generate && npm run build && npx prisma migrate deploy`
5. **Start Command:** `node dist/main`
6. Em **Environment**, adicione todas as variáveis do `.env.example`
7. Configure o **CRON** anti-sleep:
   - https://uptimerobot.com (grátis) → ping na URL do Render a cada 5 minutos

## 4. Frontend — Vercel

1. Crie conta em https://vercel.com
2. **Import Project** > selecione o repositório
3. **Root Directory:** `frontend`
4. **Build Command:** `npm run build`
5. **Output Directory:** `dist`
6. Em **Environment Variables**, adicione:
   - `VITE_API_URL=https://[seu-backend].onrender.com/api`
7. Faça o deploy

## 5. Configuração CORS

No backend (`backend/.env`), atualize:
```
FRONTEND_URL=https://[seu-frontend].vercel.app
```

## 6. Primeiro acesso

- E-mail: admin@wantuil.org.br
- Senha: admin123

**Troque a senha imediatamente em Configurações.**

## 7. Custo total

| Item | Custo |
|---|---|
| Supabase Free | R$ 0 |
| Render Free | R$ 0 |
| Vercel Free | R$ 0 |
| Resend Free (3000/mês) | R$ 0 |
| **TOTAL** | **R$ 0** |

