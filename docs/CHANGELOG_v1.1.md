# Changelog v1.1

## 🐛 Correções

- **Login de usuários novos não funcionava**: corrigido bug no `users.service.ts` que tinha risco de salvar a senha em texto puro. Agora a senha é hasheada com bcrypt antes de salvar, e o campo `ativo: true` é definido explicitamente.
- **E-mail case-sensitive**: e-mails agora são normalizados (trim + lowercase) tanto no cadastro quanto no login, evitando casos de "admin@x.com" não logar porque foi cadastrado como "Admin@X.com".

## ✨ Novidades

### Sistema de exclusão em todas as entidades

| Entidade | Comportamento ao excluir |
|---|---|
| **Item** | Sem movimentação: exclui. Com movimentação: desativa (preserva histórico) |
| **Doador** | Sem doações: exclui. Com doações: desativa |
| **Beneficiário** | Sem retiradas: exclui. Com retiradas: desativa |
| **Setor** | Sem itens nem histórico: exclui. Com itens: bloqueia (mover primeiro). Com histórico: desativa |
| **Categoria** | Sem itens: exclui. Com itens: bloqueia |
| **Usuário** | Sem ações no log: exclui. Com histórico: desativa. Nunca pode excluir a si mesmo |

### Sistema de Roles funcional

Quatro perfis com permissões diferentes:

| Perfil | Pode fazer |
|---|---|
| **ADMIN** | Tudo (incluindo excluir, gerenciar usuários, ver auditoria) |
| **ALMOXARIFE** | Movimentações, cadastros, etiquetas. Não exclui. |
| **GESTOR** | Apenas visualização + exportar relatórios |
| **OPERADOR** | Apenas cadastros de doadores e beneficiários |

**Implementação dupla (backend + frontend):**

1. **Backend (`PerfilGuard`)**: cada endpoint protegido tem o decorator `@Perfis('ADMIN', 'ALMOXARIFE')`. Se o usuário tentar bater na API sem permissão, recebe `403 Forbidden`.

2. **Frontend (`AuthContext.podeFazer`)**:
   - **Menu lateral**: opções sem permissão somem
   - **Botões**: ações sem permissão não aparecem
   - **Rotas**: tentar acessar `/configuracoes` como GESTOR mostra tela de "Acesso negado"

### Outras melhorias

- Confirmação visual em todas as exclusões com explicação do que vai acontecer
- Nome e perfil do usuário visíveis no rodapé do menu lateral
- Aba de Categorias adicionada em Configurações
- Endpoint `GET /api/auth/me` para validar sessão atual
- Mensagens de erro melhoradas ("E-mail ou senha incorretos" em vez de "Credenciais inválidas")
- Usuário não pode desativar nem excluir a si mesmo

## ⚠️ Importante para usuários atualizando

Se você tem **usuários antigos cadastrados com senha que não funcionava**:

1. Entre como admin
2. Vá em **Configurações → Usuários**
3. Para cada usuário com problema: clique em ✏️ Editar e defina uma nova senha
4. Faça logout e teste com a nova senha
