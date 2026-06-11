# Manual de Uso — Sistema de Almoxarifado Wantuil

## Visão geral dos perfis

| Perfil | O que pode fazer |
|---|---|
| **Administrador** | Tudo: cadastros, movimentações, relatórios, usuários, configurações |
| **Almoxarife** | Entradas, saídas, etiquetas, descartes, edição de itens |
| **Gestor** | Visualização e exportação de relatórios |
| **Operador** | Cadastros de doadores e beneficiários |

## Fluxo de trabalho diário

### Receber uma doação

1. Vá em **Entradas**
2. Selecione o doador (ou "Doação avulsa")
3. Para cada item:
   - Clique em **📷 Scanner** ou digite o EAN
   - Se o produto for novo, o sistema busca na Open Food Facts e sugere o cadastro
   - Informe a quantidade e a data de validade (se houver)
4. Clique em **✅ Confirmar entrada**
5. Para cada item, clique em **🏷️** para imprimir a etiqueta
6. Cole as etiquetas nos produtos antes de guardar no almoxarifado

### Entregar para um beneficiário

1. Vá em **Saídas**
2. Selecione "Beneficiário" e escolha quem está retirando
3. Adicione os itens (busque pelo nome ou escaneie a etiqueta)
4. Se algum item vai ficar abaixo do mínimo, o sistema mostra um alerta amarelo
5. Clique em **✅ Confirmar saída**
6. Se o saldo final realmente vai ficar abaixo do mínimo, o sistema pede uma confirmação extra
7. Imprima o comprovante de entrega

### Mandar para um setor interno

Mesmo fluxo das saídas, mas escolha "Setor interno" e selecione o setor (Cozinha, Enfermaria, etc.)

## Controle de validade

O sistema classifica automaticamente cada produto em 5 estados:

- 🟢 **Vigente** — Mais de 30 dias até o vencimento
- 🟡 **Próximo ao vencimento** — Faltam 30 dias ou menos
- 🟠 **Vencido** — Passou da validade
- 🟠 **Período Adicional** — Vencido há menos de 6 meses (pode ser usado com critério)
- 🔴 **Descarte** — Vencido há mais de 6 meses (descarte obrigatório)

### Resumo semanal

Todo **sábado às 08h00** o sistema envia um e-mail com:
- Produtos próximos ao vencimento (≤ 30 dias)
- Produtos no período adicional
- Produtos para descarte
- Produtos abaixo do estoque mínimo

### Alertas imediatos

- Quando um produto vence → e-mail no dia
- Quando um produto completa 6 meses pós-vencimento → e-mail no dia

## Impressão de etiquetas

As etiquetas têm **50 × 25 mm** e contêm:
- Nome do produto em destaque
- Data de entrada
- Data de validade (ou "S/VALIDADE")
- Código de barras Code128 (mesmo EAN da embalagem original, ou código interno WF-XXXXX se sem EAN)

**Impressora recomendada:** qualquer impressora de etiqueta térmica que aceite rolos de 50×25mm (Argox, Elgin L42, Zebra GC420, etc.)

## Backup

O Supabase faz backup automático diário. Recomenda-se também:
- Toda semana, exporte os relatórios em Excel
- Toda movimentação fica registrada no log de auditoria

