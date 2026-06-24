# 📦 SOLUÇÃO COMPLETA - PostgreSQL Independente

## 🎯 Resumo

Esta pasta contém **TUDO** que você precisa para migrar do Supabase para PostgreSQL independente e resolver de vez os problemas de upload de imagens, CORS e RLS.

---

## 📂 Arquivos Disponíveis

### 🗂️ Schema e Migração

| Arquivo | Descrição |
|---------|-----------|
| [`SCHEMA_POSTGRESQL_COMPLETO.sql`](./SCHEMA_POSTGRESQL_COMPLETO.sql) | ⭐ **Schema completo** com todas as 30+ tabelas do sistema |
| [`MIGRACAO_POSTGRESQL.md`](./MIGRACAO_POSTGRESQL.md) | 📖 **Guia passo-a-passo** de migração completa |
| [`BACKUP_SUPABASE.sql`](./BACKUP_SUPABASE.sql) | 💾 Script para **exportar dados** do Supabase |

### 🔧 Fixes do Supabase (se quiser continuar usando)

| Arquivo | Descrição |
|---------|-----------|
| [`fixes/CONFIGURAR_STORAGE_IMAGENS.sql`](./fixes/CONFIGURAR_STORAGE_IMAGENS.sql) | Configurar bucket de imagens |
| [`fixes/CONFIGURAR_CORS_STORAGE.sql`](./fixes/CONFIGURAR_CORS_STORAGE.sql) | Fix adicional para CORS |
| [`fixes/README_SOLUCAO_IMAGENS.md`](./fixes/README_SOLUCAO_IMAGENS.md) | Guia completo de troubleshooting |
| [`fixes/ERRO_400_SOLUCAO.md`](./fixes/ERRO_400_SOLUCAO.md) | Solução para erro 400 específico |
| [`fixes/CREATE_PRODUCT_REVIEWS.sql`](./fixes/CREATE_PRODUCT_REVIEWS.sql) | Criar tabela de reviews |
| [`fixes/IMPROVE_USER_MANAGEMENT_RLS.sql`](./fixes/IMPROVE_USER_MANAGEMENT_RLS.sql) | Melhorar RLS de usuários |

---

## 🚀 OPÇÃO 1: Migrar para PostgreSQL (Recomendado)

### ✅ Vantagens:
- 🆓 **Totalmente gratuito** e sem limites
- ⚡ **Mais rápido** (banco local)
- 🎯 **Sem CORS**, sem RLS, sem bugs do Supabase
- 🔒 **Controle total** sobre dados e backups
- 📦 **Mais simples** de gerenciar

### 📋 Como Fazer:

1. **Instalar PostgreSQL**
   - Windows: https://www.postgresql.org/download/windows/
   - Linux: `sudo apt install postgresql`
   - MacOS: `brew install postgresql@14`

2. **Criar banco de dados**
   ```bash
   createdb -U postgres naturerva_erp
   ```

3. **Executar schema**
   ```bash
   psql -U postgres -d naturerva_erp -f sql/SCHEMA_POSTGRESQL_COMPLETO.sql
   ```

4. **(Opcional) Exportar dados do Supabase**
   - Execute [`BACKUP_SUPABASE.sql`](./BACKUP_SUPABASE.sql) no Supabase SQL Editor
   - Copie resultado e salve como `backup_dados.sql`
   - Importe: `psql -U postgres -d naturerva_erp -f backup_dados.sql`

5. **Configurar `.env`**
   ```env
   VITE_DATABASE_TYPE=postgresql
   VITE_PG_HOST=localhost
   VITE_PG_PORT=5432
   VITE_PG_DATABASE=naturerva_erp
   VITE_PG_USER=postgres
   VITE_PG_PASSWORD=sua_senha
   ```

6. **Instalar dependência**
   ```bash
   npm install postgres
   ```

7. **Atualizar código**
   - Substituir `supabase` por cliente `postgres`
   - Ver exemplos em [`MIGRACAO_POSTGRESQL.md`](./MIGRACAO_POSTGRESQL.md)

8. **Configurar storage de imagens**
   - **Opção A:** Local (`public/uploads/`)
   - **Opção B:** Cloudinary (grátis até 25GB)
   - **Opção C:** AWS S3, ImageKit, etc.

📖 **Guia detalhado:** [`MIGRACAO_POSTGRESQL.md`](./MIGRACAO_POSTGRESQL.md)

---

## 🔧 OPÇÃO 2: Continuar com Supabase

Se preferir manter o Supabase por enquanto:

### 📋 Passos para Resolver Upload de Imagens:

1. **Execute:** [`fixes/CONFIGURAR_STORAGE_IMAGENS.sql`](./fixes/CONFIGURAR_STORAGE_IMAGENS.sql)
2. **Se erro 400 persistir:** Siga [`fixes/ERRO_400_SOLUCAO.md`](./fixes/ERRO_400_SOLUCAO.md)
3. **Verifique:**
   - Bucket `product-images` está **público** ✅
   - 4 políticas RLS criadas ✅
   - File size limit = 5MB ✅

### ⚠️ Limitações do Supabase:

- ❌ Plano gratuito limitado (500MB storage)
- ❌ RLS complexo e propenso a bugs
- ❌ CORS pode dar problemas aleatórios
- ❌ Performance depende da rede
- ❌ Menos controle sobre infraestrutura

---

## 📊 Comparação das Opções

| Aspecto | PostgreSQL ⭐ | Supabase |
|---------|--------------|----------|
| **Custo** | 🟢 Gratuito sempre | 🟡 Grátis limitado |
| **Storage Imagens** | 🟢 Sem limites | 🔴 500MB grátis |
| **Performance** | 🟢 Local = Rápido | 🟡 Via rede |
| **Complexidade** | 🟢 Simples | 🔴 RLS + CORS |
| **Controle** | 🟢 Total | 🔴 Limitado |
| **Backup** | 🟢 Fácil | 🟡 Manual |
| **CORS** | 🟢 Não existe | 🔴 Problemático |
| **Bugs** | 🟢 Raros | 🔴 Frequentes |

---

## 🎯 Recomendação

### 💡 Para Produção: **PostgreSQL Independente**

**Motivos:**
1. ✅ Resolve **definitivamente** o problema de imagens
2. ✅ Sem custos mensais
3. ✅ Mais rápido e confiável
4. ✅ Controle total sobre dados
5. ✅ Mais simples de debugar

### 🧪 Para Testes: **Supabase**

Use apenas se:
- Não quer instalar PostgreSQL agora
- Está apenas testando a aplicação
- Aceita as limitações

---

## 📚 Estrutura do Banco

O schema completo inclui **30+ tabelas**:

### 👥 Autenticação e Usuários
- `profiles` - Perfis de usuários
- `roles` - Funções/papéis
- `permissions` - Permissões
- `user_roles` - Associação usuário-role
- `role_permissions` - Associação role-permissão

### 📦 Produtos
- `products` - Produtos principais
- `product_variants` - Variações de produtos
- `product_reviews` - Avaliações
- `categories` - Categorias
- `units` - Unidades de medida

### 👤 Clientes
- `customers` - Dados de clientes
- `customer_actions` - Ações de follow-up
- `customer_feedback` - Feedbacks
- `customer_insights` - Insights analíticos

### 🛒 Vendas e Pedidos
- `orders` - Pedidos online/balcão
- `sales` - Vendas registradas
- `delivery_zones` - Zonas de entrega

### 📦 Compras e Fornecedores
- `suppliers` - Fornecedores
- `purchases` - Compras realizadas
- `purchase_requests` - Requisições de compra

### 📊 Stock e Inventário
- `stock_movements` - Movimentos de stock
- `stock_transactions` - Transações detalhadas
- `stock_adjustments` - Ajustes manuais
- `stock_audits` - Auditorias de inventário
- `stock_audit_items` - Itens de auditoria

### ⚙️ Gestão
- `locations` - Lojas/armazéns
- `weekly_goals` - Metas semanais
- `pending_approvals` - Aprovações pendentes
- `audit_logs` - Logs de auditoria
- `activities` - Registro de atividades

---

## 🛠️ Suporte

### 📖 Documentação:
- [Guia de Migração](./MIGRACAO_POSTGRESQL.md) - Completo e detalhado
- [Troubleshooting Supabase](./fixes/README_SOLUCAO_IMAGENS.md) - Problemas comuns

### 💬 Problemas Comuns:

**❌ "Imagens não aparecem"**
- **PostgreSQL:** Configure Cloudinary ou storage local
- **Supabase:** Execute [`fixes/CONFIGURAR_STORAGE_IMAGENS.sql`](./fixes/CONFIGURAR_STORAGE_IMAGENS.sql)

**❌ "Erro 400 ao carregar imagens"**
- **Supabase:** Siga [`fixes/ERRO_400_SOLUCAO.md`](./fixes/ERRO_400_SOLUCAO.md)
- **PostgreSQL:** Não existe este problema!

**❌ "Erro de conexão"**
- **PostgreSQL:** Verifique se PostgreSQL está rodando
- **Supabase:** Verifique credenciais no `.env`

---

## 🎉 Resultado Final

Após migração para PostgreSQL:

✅ **Upload de imagens funciona perfeitamente**  
✅ **Sem erros 400, 403 ou CORS**  
✅ **Performance superior**  
✅ **Controle total sobre dados**  
✅ **Custos = R$ 0,00**  
✅ **Sistema mais simples e estável**  

---

## 🚀 Próximos Passos

1. ✅ Decida: PostgreSQL ou Supabase?
2. 📖 Leia o guia apropriado
3. 🗂️ Execute os scripts SQL
4. ⚙️ Configure o `.env`
5. 🧪 Teste a aplicação
6. 🎉 Aproveite um sistema sem problemas!

---

**Última atualização:** 2026-04-30  
**Versão:** 1.0.0
