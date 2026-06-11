# Sistema de Gestão de Almoxarifado
## Instituição de Caridade Wantuil de Freitas — Cuiabá/MT

Sistema completo para gestão de almoxarifado de instituições de caridade, com controle de doações, distribuição, validade de produtos, alertas semanais por e-mail e impressão de etiquetas com código de barras.

---

## Funcionalidades

- **Dashboard** com indicadores em tempo real e alertas críticos
- **Cadastro de itens** com leitura de código de barras (EAN) via câmera ou scanner USB
- **Integração com Open Food Facts** — produtos industrializados são reconhecidos automaticamente
- **Entradas (doações)** com vínculo ao doador e geração de etiquetas
- **Saídas (distribuição)** para beneficiários ou setores internos, com confirmação obrigatória quando o saldo fica abaixo do mínimo
- **Controle de validade** com 5 estados (Vigente → Próximo → Vencido → Período Adicional → Descarte)
- **Notificações automáticas** todo sábado às 08h00 + alertas imediatos por e-mail (via Resend)
- **Etiquetas 50×25mm** em PDF com nome, datas de entrada e validade, e código de barras Code128
- **Cadastro de doadores** (PF/PJ) com validação real de CPF/CNPJ
- **Cadastro de beneficiários** com ativação/inativação
- **Setores internos** (Cozinha, Enfermaria, Abrigo, etc.)
- **Relatórios** com exportação para Excel
- **Controle de perfis** (Admin, Almoxarife, Gestor, Operador) com JWT
- **Log de auditoria** completo

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite + React Router |
| Backend | NestJS 10 + TypeScript |
| Banco | PostgreSQL (Supabase) |
| ORM | Prisma |
| Autenticação | JWT + bcrypt |
| Códigos de barras | @zxing/browser (leitura) + Code128 nativo (geração) |
| Etiquetas PDF | PDFKit |
| Excel | ExcelJS |
| E-mails | Resend (3.000/mês grátis) |
| Cron Jobs | @nestjs/schedule |

---

## Instalação (Desenvolvimento)

### Pré-requisitos
- Node.js 20+
- Conta gratuita no [Supabase](https://supabase.com)
- Conta gratuita no [Resend](https://resend.com) (opcional, para e-mails)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edite o .env com suas credenciais do Supabase
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

A API estará em `http://localhost:3000/api`.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

O sistema estará em `http://localhost:5173`.

### 3. Acesso inicial

- **E-mail:** admin@wantuil.org.br
- **Senha:** admin123

Troque a senha imediatamente em Configurações.

---

## Deploy em produção (infraestrutura gratuita)

| Serviço | Para que serve | Plano free |
|---|---|---|
| **Vercel** | Frontend React | Ilimitado |
| **Render** | Backend NestJS | 750h/mês |
| **Supabase** | Banco PostgreSQL | 500MB |
| **Resend** | E-mails | 3.000/mês |

Veja `docs/DEPLOY.md` para instruções passo a passo.

---

## Estrutura do projeto

```
.
├── backend/                  # API NestJS
│   ├── prisma/
│   │   ├── schema.prisma     # Modelo de dados
│   │   └── seed.ts           # Dados iniciais
│   └── src/
│       ├── auth/             # Login + JWT
│       ├── users/            # Usuários do sistema
│       ├── itens/            # CRUD de itens + status de validade
│       ├── categorias/
│       ├── setores/
│       ├── doadores/         # Com validação CPF/CNPJ
│       ├── beneficiarios/
│       ├── movimentacoes/    # Entradas, saídas, descarte, estorno
│       ├── etiquetas/        # Geração de PDF 50x25mm
│       ├── relatorios/       # Exportação Excel
│       └── notificacoes/     # Cron semanal + alertas
├── frontend/                 # SPA React + Vite
│   └── src/
│       ├── api/              # Cliente axios com JWT
│       ├── components/       # Layout, Scanner
│       ├── context/          # AuthContext
│       ├── pages/            # Telas
│       └── utils/
└── docs/                     # Documentação
```

---

## Regras de Negócio Implementadas

1. **RN-01:** Saldo nunca pode ser negativo
2. **RN-02:** Saída abaixo do mínimo exige confirmação explícita do usuário
3. **RN-03:** Movimentações não são excluídas — apenas estornadas (gera novo registro)
4. **RN-04:** Cada item recebe código interno único (WF-XXXXX) ou usa EAN se disponível
5. **RN-05:** EAN desconhecido abre formulário de cadastro manual pré-preenchido
6. **RN-06:** Etiqueta gerada após entrada com nome, datas e código de barras
7. **RN-07:** Janela de alerta de validade começa 30 dias antes
8. **RN-08:** Após vencimento, item entra em Período Adicional de 6 meses
9. **RN-09:** Após 6 meses do vencimento, item entra em estado Descarte
10. **RN-10:** CPF/CNPJ duplicado é bloqueado no cadastro
11. **RN-11:** Beneficiário inativo não pode receber itens
12. **RN-12:** Resumo semanal vai todo sábado 08h00 (Brasília)
13. **RN-13:** Itens sem validade não participam do controle de vencimento

---

## Suporte

Este sistema foi desenvolvido para a Instituição de Caridade Wantuil de Freitas em Cuiabá/MT.
Para customizações ou suporte, entre em contato.

**Versão:** 1.0  
**Data:** Junho de 2026
