# ❌ ERRO 400 (Bad Request) ao carregar imagens

## 🔍 Diagnóstico
Você está vendo:
- ✅ Upload funciona: "Upload concluído com sucesso"
- ✅ Verificação passa: "Imagem acessível e carregando corretamente!"
- ❌ Navegador retorna: **400 (Bad Request)** ao carregar `<img>`

**Causa:** Falta configuração de **CORS** no Supabase Storage.

---

## 🚀 SOLUÇÃO (5 minutos)

### PASSO 1: Reconfigurar Bucket

#### Via SQL Editor (Recomendado):
1. Abra: https://supabase.com/dashboard
2. Vá para: **SQL Editor** > **New query**
3. Execute o script: [`sql/fixes/CONFIGURAR_CORS_STORAGE.sql`](./CONFIGURAR_CORS_STORAGE.sql)

---

### PASSO 2: Configurar CORS na Interface

1. **Vá para:** Supabase Dashboard > Storage > **product-images**

2. **Clique em:** Configuration (engrenagem no topo direito)

3. **Verifique estas configurações:**
   - ✅ **Public bucket:** ATIVADO
   - ✅ **File size limit:** `5242880` (5MB)
   - ✅ **Allowed MIME types:** 
     ```
     image/jpeg
     image/png
     image/webp
     image/gif
     ```

4. **Clique em:** Save

---

### PASSO 3: Verificar Storage CORS Settings

1. **Vá para:** Settings (⚙️) > **API**

2. **Role até:** Storage section

3. **Verifique:** CORS Configuration

4. **Se necessário, adicione:**
   ```
   Allowed origins: *
   ```
   OU especificamente seu domínio:
   ```
   http://localhost:3055
   ```

---

### PASSO 4: Limpar Cache e Testar

1. **Feche completamente o navegador**
2. **Reabra** e acesse a aplicação
3. **Abra o Console** (F12)
4. **Tente fazer upload** de uma imagem nova

---

## 🧪 Teste Alternativo: Via Dashboard

Se ainda não funcionar, tente fazer upload **direto pelo Supabase Dashboard**:

1. Vá para: **Storage** > **product-images**
2. Clique em **Upload File**
3. Faça upload de uma imagem de teste
4. Clique na imagem e copie a **Public URL**
5. Tente abrir essa URL em uma **nova aba do navegador**

**Se a URL abrir a imagem** → Problema de CORS resolvido
**Se der erro 400** → Problema persiste, veja próxima seção

---

## 🔧 Solução Avançada: Recriar Bucket

Se nada funcionar, o bucket pode estar corrompido. **Recrie-o:**

### ⚠️ AVISO: Isso apagará todas as imagens existentes!

```sql
-- 1. Deletar bucket antigo
DELETE FROM storage.buckets WHERE id = 'product-images';

-- 2. Recriar bucket com configurações corretas
INSERT INTO storage.buckets (
  id, 
  name, 
  public,
  file_size_limit,
  allowed_mime_types
) VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- 3. Recriar políticas RLS (execute todo o script CONFIGURAR_STORAGE_IMAGENS.sql)
```

---

## 📋 Checklist Final

Após executar os passos acima:

- [ ] Bucket `product-images` está **público**
- [ ] File size limit = 5MB
- [ ] MIME types configurados
- [ ] 4 políticas RLS criadas
- [ ] CORS settings verificadas
- [ ] Cache limpo
- [ ] Upload de teste funciona
- [ ] Navegador carrega imagem sem erro 400

---

## 💡 Dica Extra

Se você tem acesso ao **project settings** do Supabase, verifique também:

1. **Settings** > **Database** > **Extensions**
2. Certifique-se de que `storage` está **habilitado**

---

## 🆘 Ainda não funciona?

Se após todos os passos ainda houver erro 400:

1. **Copie** a URL exata da imagem do console
2. **Tente acessar** diretamente no navegador
3. **Me envie** o resultado (erro ou sucesso)
4. **Mostre** o console com os logs completos

---

**Execute os passos 1-4 e me avise o resultado!** 🔧
