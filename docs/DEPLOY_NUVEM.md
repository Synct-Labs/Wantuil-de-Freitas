# 🚀 Guia Completo: Subir o Sistema na Nuvem

**Tempo estimado:** 30-40 minutos  
**Custo:** R$ 0,00/mês (todos os serviços têm plano gratuito permanente)

---

## ✅ Checklist antes de começar

Crie contas gratuitas em:

- [ ] [GitHub](https://github.com) — para guardar o código
- [ ] [Supabase](https://supabase.com) — banco de dados PostgreSQL
- [ ] [Render](https://render.com) — onde a API vai rodar
- [ ] [Vercel](https://vercel.com) — onde a interface vai rodar
- [ ] [Resend](https://resend.com) — envio de e-mails (opcional)
- [ ] [UptimeRobot](https://uptimerobot.com) — manter o servidor acordado

Instale também:
- [ ] [Node.js 20+](https://nodejs.org)
- [ ] [Git](https://git-scm.com)

---

## ETAPA 1: Subir o código para o GitHub (5 min)

### 1.1 Criar repositório no GitHub
1. Acesse https://github.com/new
2. Nome: `almoxarifado-wantuil`
3. Marque **Private** (privado)
4. Clique em **Create repository**

### 1.2 Enviar o código
Abra o terminal/prompt na pasta descompactada do zip:

```bash
cd almoxarifado-wantuil
git init
git add .
git commit -m "Versão inicial do sistema"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/almoxarifado-wantuil.git
git push -u origin main
```

> Substitua `SEU_USUARIO` pelo seu nome de usuário no GitHub.

---

## ETAPA 2: Criar o banco de dados no Supabase (5 min)

### 2.1 Criar projeto
1. Acesse https://supabase.com/dashboard
2. Clique em **New Project**
3. Preencha:
   - **Name:** `almoxarifado-wantuil`
   - **Database Password:** crie uma senha forte e **ANOTE**
   - **Region:** `South America (São Paulo)` — mais próximo do MT
4. Clique em **Create new project** e aguarde ~2 min

### 2.2 Pegar as credenciais
1. No menu lateral, clique em **Settings (⚙️) → Database**
2. Role até **Connection string**
3. Você vai precisar de **duas URLs**:

**a) Connection pooling (porta 6543)** — use para `DATABASE_URL`:
```
postgresql://postgres.xxxxx:[SUA_SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**b) Direct connection (porta 5432)** — use para `DIRECT_URL`:
```
postgresql://postgres.xxxxx:[SUA_SENHA]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

> Substitua `[SUA_SENHA]` pela senha que você criou no passo 2.1.

---

## ETAPA 3: Subir a API (backend) no Render (10 min)

### 3.1 Criar serviço
1. Acesse https://dashboard.render.com
2. Clique em **New → Web Service**
3. Conecte sua conta GitHub se ainda não conectou
4. Selecione o repositório `almoxarifado-wantuil`
5. Clique em **Connect**

### 3.2 Configurar o build
Preencha exatamente assim:

| Campo | Valor |
|---|---|
| **Name** | `almoxarifado-api` |
| **Region** | Ohio (mais próximo do Brasil disponível no free) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install && npx prisma generate && npm run build && npx prisma migrate deploy && npx prisma db seed` |
| **Start Command** | `node dist/main` |
| **Instance Type** | **Free** |

### 3.3 Adicionar variáveis de ambiente
Role até **Environment Variables** e adicione cada uma clicando em **Add Environment Variable**:

| Key | Value |
|---|---|
| `DATABASE_URL` | Cole a URL com porta 6543 (Etapa 2.2.a) |
| `DIRECT_URL` | Cole a URL com porta 5432 (Etapa 2.2.b) |
| `JWT_SECRET` | Gere uma chave de 64 caracteres (use https://generate-secret.now.sh/64) |
| `JWT_EXPIRES` | `8h` |
| `PORT` | `3000` |
| `FRONTEND_URL` | Deixe vazio por enquanto, atualize após a Etapa 4 |
| `RESEND_API_KEY` | Deixe vazio (configurar depois) |
| `EMAIL_FROM` | `Almoxarifado <onboarding@resend.dev>` |
| `EMAIL_NOTIFICACOES` | Seu e-mail pessoal por enquanto |

### 3.4 Deploy
Clique em **Create Web Service** e aguarde ~5 minutos.

Quando aparecer **"Your service is live 🎉"**, copie a URL que aparece no topo. Será algo como:
```
https://almoxarifado-api.onrender.com
```

### 3.5 Teste rápido
Abra no navegador: `https://almoxarifado-api.onrender.com/api/auth/login`

Deve aparecer um erro JSON dizendo "Bad Request" — isso é normal, significa que a API está respondendo!

---

## ETAPA 4: Subir o frontend no Vercel (5 min)

### 4.1 Importar projeto
1. Acesse https://vercel.com/new
2. Clique em **Import** ao lado do repositório `almoxarifado-wantuil`

### 4.2 Configurar
| Campo | Valor |
|---|---|
| **Project Name** | `almoxarifado-wantuil` |
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` (clique em **Edit** se necessário) |
| **Build Command** | (deixe o padrão) |
| **Output Directory** | (deixe o padrão) |

### 4.3 Variáveis de ambiente
Em **Environment Variables**, adicione:

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://almoxarifado-api.onrender.com/api` |

### 4.4 Deploy
Clique em **Deploy** e aguarde ~2 min.

Quando concluir, copie a URL que aparece. Será algo como:
```
https://almoxarifado-wantuil.vercel.app
```

### 4.5 Voltar ao Render para atualizar o CORS
1. Volte ao painel do Render → seu serviço → **Environment**
2. Edite a variável `FRONTEND_URL` e cole a URL do Vercel
3. Clique em **Save Changes** — o backend vai reiniciar sozinho

---

## ETAPA 5: Configurar e-mails (Resend) — opcional (5 min)

### 5.1 Criar conta
1. Acesse https://resend.com/signup
2. Confirme o e-mail

### 5.2 Pegar a API Key
1. No painel, vá em **API Keys → Create API Key**
2. Nome: `almoxarifado-producao`
3. Permission: **Full Access**
4. Copie a chave (começa com `re_...`)

### 5.3 Atualizar no Render
1. Painel Render → Environment
2. Cole em `RESEND_API_KEY`
3. Em `EMAIL_NOTIFICACOES`, coloque o e-mail da responsável da instituição
4. Save Changes

> **Nota:** Sem configurar domínio próprio, o Resend só permite enviar e-mails para o e-mail da sua própria conta. Para enviar para qualquer pessoa, é preciso validar um domínio (15 min, gratuito).

---

## ETAPA 6: Manter o servidor acordado (CRUCIAL!) (5 min)

O Render plano grátis **hiberna** o servidor após 15 min sem uso. Para manter sempre acordado:

### 6.1 Criar monitor no UptimeRobot
1. Acesse https://uptimerobot.com/signUp
2. Após login, clique em **+ New monitor**
3. Configure:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Almoxarifado API
   - **URL:** `https://almoxarifado-api.onrender.com/api`
   - **Monitoring Interval:** 5 minutes
4. Clique em **Create Monitor**

Pronto! Agora a API recebe um ping a cada 5 minutos e nunca dorme durante o horário de uso.

---

## ETAPA 7: Primeiro acesso 🎉

Abra a URL do Vercel: `https://almoxarifado-wantuil.vercel.app`

**Login inicial:**
- E-mail: `admin@wantuil.org.br`
- Senha: `admin123`

### IMPORTANTE — Faça AGORA:
1. Vá em **Configurações → Usuários**
2. Crie um novo usuário Admin com o e-mail da responsável
3. Faça logout e teste o login dela
4. Apague o usuário `admin@wantuil.org.br` (ou troque a senha)

---

## 🔄 Como atualizar o sistema no futuro

Quando você quiser fazer alterações:

```bash
# Faça as mudanças no código
git add .
git commit -m "Descrição da mudança"
git push
```

**O Render e o Vercel detectam automaticamente** e fazem o deploy em ~2 min.

---

## 📊 Limites dos planos gratuitos

| Serviço | Limite Free | É suficiente? |
|---|---|---|
| **Supabase** | 500 MB de banco | ✅ Sim (dá pra ~100k movimentações) |
| **Render** | 750h/mês | ✅ Sim (mês tem 720h) |
| **Vercel** | 100 GB de banda | ✅ Sim |
| **Resend** | 3.000 e-mails/mês | ✅ Sim (4 e-mails/semana = 16/mês) |

---

## 🆘 Problemas comuns

### "Database connection failed" no Render
- Verifique se `DATABASE_URL` está com a porta **6543** (Pooler)
- Verifique se substituiu `[SUA_SENHA]` corretamente

### "CORS error" no navegador
- Confirme que `FRONTEND_URL` no Render bate exatamente com a URL do Vercel
- Inclua `https://` no começo

### Site demora ~30s para abrir na primeira vez
- O Render dormiu. Configure o UptimeRobot (Etapa 6).

### "ECONNREFUSED" ao tentar login
- A API ainda está iniciando. Aguarde 1 minuto e tente de novo.

