# Sistema de Almoxarifado
## Associação Espírita Wantuil de Freitas — Cuiabá/MT

Sistema completo de gestão de almoxarifado para instituições de caridade. Controla doações, distribuição, lotes com validade, eventos, reservas, alertas semanais por e-mail e impressão de etiquetas com código de barras.

Desenvolvido sob medida pela **SYNCT Labs**.

---

## Funcionalidades

### Operação diária
- **Dashboard** com alertas críticos, movimentações recentes e saldo geral
- **Cadastro de itens** com leitura de código de barras (EAN) via câmera ou scanner USB
- **Cascata de APIs externas** para enriquecimento automático (Open Food Facts, Bluesoft Cosmos, etc.)
- **Entradas (doações)** com vínculo opcional ao doador, geração de etiqueta Code128 e criação de lote único
- **Saídas (distribuição)** por leitura de etiqueta **ou cadastro manual** com dropdown de lotes ordenados por validade mais próxima (FEFO)
- **Descarte registrado** com motivo, separado das saídas operacionais

### Controle e auditoria
- **Modelo de lotes** — cada entrada gera um lote único (código `L-AAAAMMDD-NNNN`) com sua própria validade. Saídas referenciam o lote específico, não só o item
- **Controle de validade em 4 estados**: Vigente → Próximo (≤30 dias) → Adicional (vencido até 6m) → Descarte (vencido +6m)
- **Estoque mínimo configurável** por item; saídas que cruzam o mínimo exigem confirmação
- **Eventos** com reservas que bloqueiam saldo do lote; sobras voltam ao estoque ao finalizar
- **Log de auditoria** técnico (acessível apenas pelo perfil MASTER)

### Notificações e relatórios
- **Resumo semanal automático** todo sábado 7h Cuiabá: e-mail com **PDF anexo** detalhando próximos do vencimento, em período adicional, descarte e abaixo do mínimo
- **Verificação diária** das notificações no sino (in-app)
- **Relatórios** com filtros por período e setor, exportáveis em PDF e Excel:
  - Posição atual do estoque
  - Movimentações por período
  - Resumo executivo
  - Doações por doador
  - Itens mais movimentados
  - Auditoria (MASTER)

### Estrutura e segurança
- **5 perfis de acesso** com matriz de permissões granular:
  - **MASTER** — dono do sistema (dev). Acesso total + logs + diagnóstico
  - **ADMIN** — diretoria. Gestão completa exceto ferramentas técnicas
  - **ALMOXARIFE** — operação principal (entradas, saídas, eventos)
  - **GESTOR** — somente leitura + relatórios
  - **OPERADOR** — apenas saídas (voluntário de evento)
- **Autenticação JWT** com bcrypt
- **HTTPS** via Let's Encrypt (renovação automática)
- **Backup diário** automatizado do banco de dados

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | NestJS 10 + TypeScript |
| Banco | PostgreSQL 16 |
| ORM | Prisma |
| Autenticação | JWT + bcrypt |
| Códigos de barras | `@zxing/browser` (leitura por câmera) + Code128 nativo (geração) |
| PDFs | PDFKit |
| Excel | ExcelJS |
| E-mails | Resend |
| Cron Jobs | `@nestjs/schedule` |
| Process manager | PM2 |
| Web server | Nginx |

---

## Arquitetura de produção

Atualmente roda em VPS própria gerenciada pela SYNCT Labs:

- **Servidor**: Hostinger KVM (Ubuntu 24.04 LTS)
- **Domínio**: `syncontrol.cloud` (HTTPS via Let's Encrypt)
- **Backend** servido por PM2 (process: `wantuil-api`, porta 3000)
- **Frontend** servido como estático pelo Nginx
- **Banco** PostgreSQL 16 local
- **Backup** diário em `/var/backups/wantuil`, retenção de 14 dias
- **Capacidade estimada**: ~3 milhões de produtos/ano nos 32 GB úteis

---

## Instalação em desenvolvimento

### Opção A — Docker (recomendado)

Sobe banco + backend + frontend em 3 containers com 1 comando.

```bash
# 1. Configurar variáveis (gera senha forte e JWT secret)
cp .env.example .env
# Edite o .env preenchendo POSTGRES_PASSWORD e JWT_SECRET
# Dica: openssl rand -hex 32  → senha de banco
#       openssl rand -hex 64  → JWT_SECRET

# 2. Subir tudo
docker compose up -d

# 3. Acompanhar logs
docker compose logs -f backend

# Acesso:
# - Frontend: http://localhost:8080
# - API:      http://localhost:8080/api
# - Docs:     http://localhost:8080/api/docs
# - Health:   http://localhost:8080/health
```

Pra desligar: `docker compose down`. Pra resetar com banco zerado: `docker compose down -v` (apaga o volume).

### Opção B — Sem Docker (clássico)

### Pré-requisitos
- Node.js 20+
- PostgreSQL 14+ rodando localmente

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edite o .env: DATABASE_URL, JWT_SECRET, RESEND_API_KEY, EMAIL_FROM
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

A API estará em `http://localhost:3000/api`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

O sistema estará em `http://localhost:5173`.

### 3. Acesso inicial

- **E-mail:** `admin@wantuil.org.br`
- **Senha:** `admin123`

Troque a senha imediatamente. Para promover o usuário a MASTER (uso exclusivo do desenvolvedor):

```sql
UPDATE "Usuario" SET perfil = 'MASTER' WHERE email = 'seu@email.com';
```

---

## Estrutura do projeto

```
.
├── backend/                       # API NestJS
│   ├── prisma/
│   │   ├── schema.prisma          # Modelo de dados (com enum Perfil de 5 níveis)
│   │   └── seed.ts                # Dados iniciais
│   └── src/
│       ├── auth/                  # Login + JWT + Guards (Jwt, Perfil)
│       ├── users/                 # Usuários com validação de perfil MASTER
│       ├── itens/                 # CRUD de itens
│       ├── lotes/                 # Gestão de lotes com validade
│       ├── categorias/
│       ├── setores/
│       ├── doadores/              # Com validação CPF/CNPJ
│       ├── beneficiarios/         # Modelo preservado (UI oculta — cliente não usa)
│       ├── eventos/               # Eventos com reservas
│       ├── movimentacoes/         # Entrada, saída, descarte, estorno
│       ├── etiquetas/             # Geração de PDF 50x25mm com Code128
│       ├── relatorios/            # PDFs e exportações Excel
│       ├── notificacoes/          # Cron semanal + PDF anexo do resumo
│       ├── sistema/               # Endpoints administrativos (MASTER)
│       └── common/                # Helpers: data-fuso (America/Cuiaba)
├── frontend/                      # SPA React + Vite
│   └── src/
│       ├── api/                   # Cliente axios com JWT
│       ├── components/            # Layout, ScannerLote, AdicionarLoteManual, Toast, NotificacoesBell
│       ├── context/               # AuthContext + matriz de permissões
│       ├── pages/                 # Telas
│       └── utils/
├── scripts/                       # Scripts de deploy e backup
└── docs/                          # Documentação técnica
```

---

## Regras de Negócio Implementadas

1. **RN-01** — Saldo do lote nunca pode ser negativo
2. **RN-02** — Saída que cruza o estoque mínimo exige confirmação explícita
3. **RN-03** — Movimentações não são excluídas — apenas estornadas (gera novo registro)
4. **RN-04** — Cada item recebe código interno único (`WF-XXXXX`) ou usa EAN se disponível
5. **RN-05** — EAN desconhecido abre formulário de cadastro pré-preenchido
6. **RN-06** — Cada entrada gera um lote `L-AAAAMMDD-NNNN` com etiqueta única
7. **RN-07** — Janela de "Próximo ao vencimento" começa 30 dias antes da validade
8. **RN-08** — Após vencimento, lote entra em "Período Adicional" por 6 meses
9. **RN-09** — Após 6 meses do vencimento, lote entra em "Descarte"
10. **RN-10** — CPF/CNPJ duplicado é bloqueado no cadastro
11. **RN-11** — Reserva em evento bloqueia saldo do lote até finalização
12. **RN-12** — Resumo semanal enviado sábado 7h Cuiabá (UTC-4) com PDF anexo
13. **RN-13** — Lotes sem data de validade ficam fora do controle de vencimento
14. **RN-14** — Apenas usuários MASTER podem criar, editar ou excluir contas MASTER
15. **RN-15** — Categorias e setores em uso são preservados em operações de limpeza

---

## Versão

**v2.8.4** — Junho de 2026

### Principais marcos
- v2.6 — Modelo de lotes (substitui saldo simples por lote individual)
- v2.7 — Módulo de eventos com reservas
- v2.7.4 — Beneficiários ocultos a pedido do cliente
- v2.7.10 — Resumo semanal com PDF anexo
- v2.8.0 — Roles segmentadas em 5 níveis com perfil MASTER
- v2.8.1 — Saída manual com dropdown FEFO

---

## Suporte

Desenvolvido pela **SYNCT Labs** para a Associação Espírita Wantuil de Freitas.

Para customizações, correções ou suporte, entre em contato com a SYNCT Labs.
