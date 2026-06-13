# Como ativar a Cosmos Bluesoft (opcional)

A Cosmos Bluesoft e considerada a **base de produtos brasileiros mais
completa do mercado**. Ela e opcional no sistema porque exige cadastro
gratuito para obter um token de acesso.

## Passo a passo

### 1. Criar conta gratuita

1. Acesse https://cosmos.bluesoft.com.br
2. Clique em "Cadastre-se gratis"
3. Preencha com o e-mail da instituicao
4. Confirme o e-mail

### 2. Obter o token

1. Apos logar, va em "Minha conta" → "API"
2. Copie o token (algo como `8e0g9T_n22f7_koK5lSeAA`)

### 3. Adicionar ao Render

1. Va ao painel do Render (https://dashboard.render.com)
2. Selecione o servico `almoxarifado-api`
3. Aba **Environment**
4. Clique em **Add Environment Variable**
5. Name: `COSMOS_TOKEN`
6. Value: cole o token copiado
7. Clique em **Save Changes**

O Render reinicia o servidor automaticamente (~2 minutos) e ja comeca
a consultar a Cosmos junto com as outras APIs brasileiras.

## Como confirmar que esta funcionando

1. Faca uma leitura de codigo de barras de um produto que voce sabe que
   nao estava sendo encontrado
2. Se aparecer, e o sistema mostrar **"Cosmos Bluesoft (referencia
   brasileira)"** como fonte, esta funcionando
3. Se preferir desativar, apenas remova a variavel `COSMOS_TOKEN` no
   Render — o sistema volta a usar so as outras APIs

## Quanto custa?

**Gratuito** com cadastro. A Bluesoft oferece um plano gratuito com
limite de consultas suficiente para o uso da instituicao. Para volumes
maiores existem planos pagos no site deles.

## Por que ativar?

A Cosmos tem dados muito mais detalhados:
- Nome completo, marca
- NCM e CEST (codigos fiscais)
- GPC (categoria global do produto)
- Imagem de alta qualidade
- Peso liquido e bruto
- Dimensoes

Para a Wantuil, na pratica, vai aumentar o numero de produtos
brasileiros encontrados no primeiro escaneamento, sem precisar
cadastrar manualmente.
