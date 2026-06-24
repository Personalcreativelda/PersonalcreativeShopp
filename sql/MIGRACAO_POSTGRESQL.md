# 🚀 MIGRAÇÃO PARA POSTGRESQL INDEPENDENTE

## 📋 Guia Completo de Migração do Supabase para PostgreSQL

---

## 🎯 VISÃO GERAL

Este guia mostra como migrar do Supabase para um banco PostgreSQL independente, eliminando problemas com Storage, RLS e outras limitações do Supabase.

---

## ⚙️ PASSO 1: Instalar PostgreSQL

### Windows:
1. Baixe: https://www.postgresql.org/download/windows/
2. Instale PostgreSQL 14+ (inclui pgAdmin)
3. Durante instalação:
   - Porta: **5432**
   - Password: escolha uma senha forte
   - Locale: **Portuguese, Portugal**

### Linux/MacOS:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# MacOS
brew install postgresql@14
brew services start postgresql@14
```

---

## 📊 PASSO 2: Criar Banco de Dados

### Via pgAdmin (Windows):
1. Abra **pgAdmin**
2. Conecte ao servidor PostgreSQL local
3. Clique direito em **Databases** > **Create** > **Database**
4. Nome: **naturerva_erp**
5. Owner: **postgres**
6. Encoding: **UTF8**
7. Salve

### Via Terminal:
```bash
# Linux/MacOS
sudo -u postgres createdb naturerva_erp

# Ou via psql
psql -U postgres
CREATE DATABASE naturerva_erp;
\q
```

---

## 🗂️ PASSO 3: Executar Script de Schema

### Via pgAdmin:
1. Abra **pgAdmin**
2. Navegue para: **Servers** > **PostgreSQL** > **Databases** > **naturerva_erp**
3. Clique em **Query Tool** (ícone SQL)
4. Abra o arquivo: [`sql/SCHEMA_POSTGRESQL_COMPLETO.sql`](../sql/SCHEMA_POSTGRESQL_COMPLETO.sql)
5. Copie **TODO** o conteúdo
6. Cole no Query Tool
7. Clique em **Execute** (▶️ ou F5)
8. Aguarde: "Query returned successfully"

### Via Terminal:
```bash
# Navegar até a pasta do projeto
cd "e:/personal Creative/NATURERVA/newlogo 2026/natur-erva-store/naturerva-ERP-main"

# Executar script
psql -U postgres -d naturerva_erp -f sql/SCHEMA_POSTGRESQL_COMPLETO.sql
```

---

## 🔧 PASSO 4: Configurar Variáveis de Ambiente

### Editar arquivo `.env`:

```env
# ============================================
# POSTGRESQL INDEPENDENTE
# ============================================
# Comente ou remova as variáveis do Supabase:
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...

# Configure a conexão PostgreSQL:
VITE_DATABASE_TYPE=postgresql
VITE_PG_HOST=localhost
VITE_PG_PORT=5432
VITE_PG_DATABASE=naturerva_erp
VITE_PG_USER=postgres
VITE_PG_PASSWORD=sua_senha_aqui

# Opcional - Pool de conexões:
VITE_PG_MAX_CONNECTIONS=20
VITE_PG_IDLE_TIMEOUT=30000
```

---

## 💾 PASSO 5: Migrar Dados Existentes (Opcional)

Se você já tem dados no Supabase e quer migrá-los:

### 1. Exportar dados do Supabase:

```bash
# Via Supabase CLI
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" > backup.sql

# Ou manualmente via Dashboard:
# Supabase Dashboard > Database > Backups > Download
```

### 2. Importar dados:

```bash
# Limpar dados de exemplo (se necessário)
psql -U postgres -d naturerva_erp -c "TRUNCATE TABLE products, customers, orders CASCADE;"

# Importar backup
psql -U postgres -d naturerva_erp -f backup.sql
```

---

## 🖼️ PASSO 6: Configurar Upload de Imagens

Como não teremos mais Supabase Storage, precisamos de uma solução alternativa:

### Opção A: Storage Local

**Criar pasta para imagens:**
```bash
mkdir -p public/uploads/products
```

**No código, modificar `imageService.ts`** para salvar localmente ao invés de Supabase Storage.

### Opção B: AWS S3 / Cloudinary / ImageKit

Configure um serviço de armazenamento de imagens separado.

**Recomendado:** Cloudinary (tem plano gratuito generoso)
- https://cloudinary.com
- 25 GB de storage grátis
- 25 GB de bandwidth por mês

---

## 🔌 PASSO 7: Atualizar Código da Aplicação

### Criar novo cliente PostgreSQL:

Crie: `front/modules/core/services/postgresClient.ts`

```typescript
import postgres from 'postgres';

const sql = postgres({
  host: import.meta.env.VITE_PG_HOST || 'localhost',
  port: parseInt(import.meta.env.VITE_PG_PORT || '5432'),
  database: import.meta.env.VITE_PG_DATABASE || 'naturerva_erp',
  username: import.meta.env.VITE_PG_USER || 'postgres',
  password: import.meta.env.VITE_PG_PASSWORD,
  max: parseInt(import.meta.env.VITE_PG_MAX_CONNECTIONS || '20'),
  idle_timeout: parseInt(import.meta.env.VITE_PG_IDLE_TIMEOUT || '30000'),
});

export default sql;
```

### Instalar dependência:

```bash
npm install postgres
# ou
yarn add postgres
```

---

## ✅ PASSO 8: Testar Conexão

### Criar script de teste:

Crie: `test-db.js`

```javascript
const postgres = require('postgres');

const sql = postgres({
  host: 'localhost',
  port: 5432,
  database: 'naturerva_erp',
  username: 'postgres',
  password: 'SUA_SENHA_AQUI',
});

async function test() {
  try {
    const result = await sql`SELECT COUNT(*) FROM products`;
    console.log('✅ Conexão OK!');
    console.log('Produtos na base:', result[0].count);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

test();
```

### Executar teste:

```bash
node test-db.js
```

**Resultado esperado:**
```
✅ Conexão OK!
Produtos na base: 0
```

---

## 🚨 TROUBLESHOOTING

### Erro: "password authentication failed"
**Solução:** Verifique a senha no arquivo `.env`

### Erro: "could not connect to server"
**Solução:** Certifique-se de que PostgreSQL está rodando:
```bash
# Windows
services.msc (procurar por "postgresql")

# Linux
sudo systemctl status postgresql

# MacOS
brew services list
```

### Erro: "database does not exist"
**Solução:** Criar o banco:
```bash
psql -U postgres -c "CREATE DATABASE naturerva_erp;"
```

### Erro: "permission denied for table"
**Solução:** Dar permissões ao usuário:
```sql
GRANT ALL PRIVILEGES ON DATABASE naturerva_erp TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
```

---

## 📊 COMPARAÇÃO: Supabase vs PostgreSQL

| Recurso | Supabase | PostgreSQL |
|---------|----------|------------|
| **Custo** | Gratuito (limitado) → Pago | **Gratuito (ilimitado)** |
| **Storage** | Limitado, com CORS | **Controle total** |
| **RLS** | Complexo, bugs | **Não necessário** |
| **Performance** | Dependente da rede | **Mais rápido (local)** |
| **Controle** | Limitado | **Total** |
| **Backup** | Automático | **Manual (fácil)** |

---

## 🎯 BENEFÍCIOS DA MIGRAÇÃO

✅ **Sem problemas de CORS** no upload de imagens  
✅ **Sem limites** de RLS ou políticas complexas  
✅ **Performance superior** (banco local)  
✅ **Controle total** sobre dados e backups  
✅ **Gratuito** sem limitações  
✅ **Mais simples** de gerenciar e debugar  

---

## 📚 PRÓXIMOS PASSOS

1. ✅ Executar [`SCHEMA_POSTGRESQL_COMPLETO.sql`](../sql/SCHEMA_POSTGRESQL_COMPLETO.sql)
2. ⚙️ Configurar `.env` com credenciais PostgreSQL
3. 🔌 Atualizar código para usar `postgres` ao invés de `supabase`
4. 🖼️ Configurar storage de imagens (Cloudinary ou local)
5. 🧪 Testar todas as funcionalidades
6. 🚀 Deploy!

---

## 📞 SUPORTE

Se encontrar problemas durante a migração:

1. Verifique logs do PostgreSQL
2. Teste conexão com `psql`
3. Revise permissões do usuário
4. Consulte: https://www.postgresql.org/docs/

---

**Última atualização:** 2026-04-30
