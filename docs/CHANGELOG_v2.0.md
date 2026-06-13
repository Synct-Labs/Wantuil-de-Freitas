# Changelog v2.0 — Identidade Visual Wantuil + Mobile + Mais APIs

## Mudancas principais

### 1. Identidade visual da Wantuil de Freitas aplicada

Logo oficial da instituicao incorporada (componente `Logo.tsx`, em SVG):
- Aparece em destaque na tela de login
- Aparece no topo do menu lateral em todas as paginas

Paleta de cores extraida da logo:
- **Azul-petroleo `#4A9BA4`** — cor principal (botoes, indicadores, destaques)
- **Azul escuro `#2A4A8A`** — menu lateral, sidebar
- **Amarelo `#F5C842`** — destaques sutis (ex: borda do item ativo no menu)
- **Branco** — fundo principal das areas de trabalho

Login redesenhado com gradient azul-petroleo + logo grande, sensacao de marca institucional.

### 2. Todos os emojis foram removidos

Substituidos por **36 icones SVG profissionais** (estilo Lucide / Feather):
- Vetoriais, escalaveis sem perda de qualidade
- Cores aplicadas via CSS (combinam com a paleta)
- Acessiveis (titulo, aria-label)
- Aparencia institucional/coorporativa, sem visual "casual" de emoji

Lista de icones: home, package, arrow-up/down, clock, building, heart, users, chart-bar, settings, log-out, menu, plus, pencil, trash, check, x, alert-triangle, alert-circle, bell, search, tag, printer, download, camera, barcode, mail, eye, eye-off, lock, shield, file-text, refresh, info, star, archive.

### 3. Sistema 100% responsivo para celular

**Menu lateral** vira drawer com backdrop em telas < 768px — botao hamburguer no topo abre/fecha.

**Tabelas viram cards** automaticamente no mobile:
- Cada linha vira um cartao individual
- Coluna `data-label` mostra o rotulo (ex: "Nome", "CPF") antes do valor
- Acoes (editar/excluir) ficam alinhadas no canto direito
- Sem scroll horizontal

**Grids** de 2, 3 ou 4 colunas no desktop colapsam para 1 coluna no mobile automaticamente.

**Formularios** (modais) ja eram fluidos, agora se ajustam com padding menor no mobile.

Testavel: abra qualquer navegador, F12 → modo responsivo → escolha "iPhone 12" ou "Galaxy S20".

### 4. Catalogo expandido: 3 APIs publicas em cascata

Antes: apenas Open Food Facts (so alimentos).

Agora — modulo `ProdutosExternosModule` no backend consulta **3 APIs em paralelo**:

| Fonte | Cobre |
|---|---|
| **Open Food Facts** | Alimentos, bebidas |
| **Open Beauty Facts** | Higiene pessoal, cabelo, cosmeticos |
| **Open Products Facts** | Produtos de limpeza, utensilios, geral |

Funcionamento: ao ler um codigo de barras, o backend consulta as 3 simultaneamente (timeout 4s cada). Retorna o primeiro produto encontrado, com a categoria sugerida automatica baseada na fonte. Exemplos:
- Bisnaga de pasta de dente → Open Beauty → categoria sugerida "Higiene"
- Detergente Ype → Open Products → categoria sugerida "Limpeza"  
- Arroz Tio Joao → Open Food → categoria sugerida "Alimentos"

Todas sao gratuitas, sem chave de API, mantidas pela comunidade.

## Arquivos novos
- `frontend/src/components/Icon.tsx` — 36 icones SVG
- `frontend/src/components/Logo.tsx` — logo Wantuil
- `frontend/public/logo-wantuil.jpg` — logo original
- `backend/src/produtos-externos/` — modulo de busca agregada
- `docs/CHANGELOG_v2.0.md` — este arquivo

## Arquivos atualizados
- `frontend/src/styles.css` — paleta + media queries mobile + tabela responsiva
- `frontend/src/components/Layout.tsx` — drawer mobile + topbar
- `frontend/src/components/Scanner.tsx` — usa endpoint agregado
- Todas as 11 paginas em `frontend/src/pages/` — limpas de emojis, com Icon
- `backend/src/app.module.ts` — registrou ProdutosExternosModule
