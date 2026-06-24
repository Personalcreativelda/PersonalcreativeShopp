# 🖼️ SOLUÇÃO: Imagens não aparecem após upload

## ❌ Problema
Você consegue fazer upload de imagens, mas elas não aparecem (mostram "URL inválida").

## ✅ Causa
O bucket `product-images` no Supabase **não está configurado para acesso público**.

---

## 🔧 SOLUÇÃO RÁPIDA (2 minutos)

### Passo 1: Abrir Supabase Dashboard
1. Acesse: https://supabase.com/dashboard
2. Faça login
3. Selecione seu projeto: **`naturerva-ERP`** (ou nome do seu projeto)

---

### Passo 2: Ir para SQL Editor
1. No menu lateral esquerdo, clique em **`SQL Editor`** (ícone de banco de dados)
2. Clique em **`New query`** (botão verde superior direito)

---

### Passo 3: Executar Script SQL
1. Abra o arquivo: [`sql/fixes/CONFIGURAR_STORAGE_IMAGENS.sql`](./CONFIGURAR_STORAGE_IMAGENS.sql)
2. **Copie TODO o conteúdo** do arquivo
3. **Cole** no SQL Editor do Supabase
4. Clique em **`Run`** (ou pressione `Ctrl+Enter`)

Você verá mensagens de sucesso indicando que:
- ✅ Bucket `product-images` foi criado/atualizado
- ✅ Políticas RLS foram configuradas
- ✅ Acesso público está habilitado

---

### Passo 4: Verificar Configuração
No SQL Editor, execute esta query para confirmar:

```sql
-- Verificar se o bucket está público
SELECT id, name, public 
FROM storage.buckets 
WHERE id = 'product-images';
```

**Resultado esperado:**
```
id               | name            | public
-----------------|-----------------|--------
product-images   | product-images  | true
```

Se `public = true`, está correto! ✅

---

### Passo 5: Testar na Aplicação
1. Volte para a aplicação
2. Abra o **Console do navegador** (F12)
3. Tente fazer upload de uma imagem novamente
4. Você deve ver no console:
   ```
   ✅ Imagem acessível e carregando corretamente!
   ```
5. A imagem deve aparecer imediatamente no preview

---

## 🎯 Configuração Alternativa (Via Interface)

Se preferir configurar manualmente via interface:

### 1. Criar/Configurar Bucket
1. Vá para: **Storage** > **Buckets**
2. Se o bucket `product-images` não existir:
   - Clique em **`New bucket`**
   - Nome: `product-images`
   - ✅ Marque **"Public bucket"**
   - File size limit: `5242880` (5MB)
   - Clique em **`Create bucket`**

3. Se já existir, clique no bucket e:
   - Vá para **Configuration**
   - ✅ Certifique-se que **"Public"** está ativado

### 2. Configurar Políticas RLS
1. No bucket `product-images`, vá para **Policies**
2. Clique em **`New Policy`**
3. Crie estas políticas:

#### Política 1: Leitura Pública
```
Name: Leitura Pública - product-images
Allowed operation: SELECT
Policy definition: (bucket_id = 'product-images')
Target roles: public
```

#### Política 2: Upload Autenticado
```
Name: Upload autenticado - product-images
Allowed operation: INSERT
Policy definition: (bucket_id = 'product-images')
Target roles: authenticated
```

#### Política 3: Update Autenticado
```
Name: Update autenticado - product-images
Allowed operation: UPDATE
Policy definition: (bucket_id = 'product-images')
Target roles: authenticated
```

#### Política 4: Delete Autenticado
```
Name: Delete autenticado - product-images
Allowed operation: DELETE
Policy definition: (bucket_id = 'product-images')
Target roles: authenticated
```

---

## 🐛 Troubleshooting

### Problema: Ainda mostra "URL inválida"
**Solução:**
1. Limpe o cache do navegador (Ctrl+Shift+Delete)
2. Feche e reabra a aplicação
3. Tente novamente

### Problema: Erro 403 no console
**Solução:**
- Verifique se as políticas RLS foram criadas corretamente
- Execute o script SQL novamente

### Problema: Erro 404 no console
**Solução:**
- Verifique se o bucket `product-images` existe
- Certifique-se de que o bucket está marcado como **público**

### Problema: Upload falha completamente
**Solução:**
1. Verifique suas credenciais do Supabase no arquivo `.env`:
   ```env
   VITE_SUPABASE_URL=sua_url_aqui
   VITE_SUPABASE_ANON_KEY=sua_chave_aqui
   ```
2. Reinicie o servidor de desenvolvimento

---

## 📚 Referências

- [Documentação do Supabase Storage](https://supabase.com/docs/guides/storage)
- [Políticas RLS no Storage](https://supabase.com/docs/guides/storage/security/access-control)
- [Configuração de Buckets Públicos](https://supabase.com/docs/guides/storage/uploads/public-buckets)

---

## ✅ Checklist Final

Após executar o script, confirme:

- [ ] Bucket `product-images` existe e está **público**
- [ ] 4 políticas RLS foram criadas
- [ ] Console mostra "✅ Imagem acessível e carregando corretamente!"
- [ ] Preview da imagem aparece no modal
- [ ] Imagem é salva corretamente no produto

Se todos os itens estão marcados, está tudo funcionando! 🎉

---

**Última atualização:** 2026-04-30
