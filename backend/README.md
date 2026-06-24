# 🚀 Backend NaturErva - Upload de Imagens

Backend Node.js simples para gerenciar upload de imagens de produtos.

## 📋 Funcionalidades

- ✅ Upload de imagens individuais e múltiplas
- ✅ Validação de tipo e tamanho de arquivo
- ✅ Armazenamento local em `uploads/products/`
- ✅ Servir imagens via HTTP
- ✅ API REST com Express
- ✅ CORS habilitado para frontend
- ✅ Deletar imagens
- ✅ Listar todas as imagens

## 🛠️ Instalação

### 1. Instalar dependências

```bash
cd backend
npm install
```

### 2. Configurar variáveis de ambiente

O arquivo `.env` já está configurado com valores padrão:

```env
PORT=3001
FRONTEND_URL=http://localhost:3055
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
ALLOWED_TYPES=image/jpeg,image/png,image/webp,image/gif
```

**Ajuste se necessário:**
- `PORT`: Porta do backend (padrão: 3001)
- `FRONTEND_URL`: URL do frontend para CORS
- `MAX_FILE_SIZE`: Tamanho máximo em bytes (padrão: 5MB)

### 3. Iniciar servidor

```bash
npm start
```

Ou com auto-reload durante desenvolvimento:

```bash
npm run dev
```

Você verá:

```
✅ Backend NaturErva rodando em http://localhost:3001
📁 Uploads disponíveis em http://localhost:3001/uploads
🌐 CORS habilitado para: http://localhost:3055
```

## 📡 API Endpoints

### 1. Health Check

```bash
GET /health
```

Resposta:
```json
{
  "status": "ok",
  "timestamp": "2026-04-30T16:30:00.000Z",
  "uptime": 123.45
}
```

### 2. Upload de Imagem Individual

```bash
POST /api/upload/product
Content-Type: multipart/form-data

Body: 
- file: (arquivo de imagem)
```

Resposta:
```json
{
  "success": true,
  "url": "/uploads/products/produto-1714495800000-123456789.jpg",
  "filename": "produto-1714495800000-123456789.jpg",
  "size": 245678,
  "mimetype": "image/jpeg"
}
```

### 3. Upload Múltiplo (até 10 imagens)

```bash
POST /api/upload/products
Content-Type: multipart/form-data

Body: 
- files[]: (array de arquivos)
```

Resposta:
```json
{
  "success": true,
  "files": [
    {
      "url": "/uploads/products/produto1-1714495800000-123456789.jpg",
      "filename": "produto1-1714495800000-123456789.jpg",
      "size": 245678,
      "mimetype": "image/jpeg"
    },
    {
      "url": "/uploads/products/produto2-1714495800000-987654321.jpg",
      "filename": "produto2-1714495800000-987654321.jpg",
      "size": 189234,
      "mimetype": "image/jpeg"
    }
  ]
}
```

### 4. Deletar Imagem

```bash
DELETE /api/upload/product/:filename
```

Exemplo:
```bash
DELETE /api/upload/product/produto-1714495800000-123456789.jpg
```

Resposta:
```json
{
  "success": true,
  "message": "Arquivo deletado com sucesso"
}
```

### 5. Listar Todas as Imagens

```bash
GET /api/upload/products
```

Resposta:
```json
{
  "files": [
    {
      "filename": "produto-1714495800000-123456789.jpg",
      "url": "/uploads/products/produto-1714495800000-123456789.jpg",
      "size": 245678,
      "created": "2026-04-30T16:30:00.000Z"
    }
  ]
}
```

### 6. Acessar Imagem

```bash
GET /uploads/products/:filename
```

Exemplo:
```
http://localhost:3001/uploads/products/produto-1714495800000-123456789.jpg
```

## 🔧 Integração com Frontend

O frontend está configurado para detectar automaticamente o backend:

**Arquivo:** `front/.env`

```env
# Backend API (Upload de Imagens)
VITE_BACKEND_URL=http://localhost:3001
VITE_USE_LOCAL_STORAGE=true
```

**Serviço:** `front/services/uploadService.ts`

O serviço detecta automaticamente se deve usar:
- ✅ Backend local (quando `VITE_USE_LOCAL_STORAGE=true`)
- ⚠️ Supabase Storage (fallback, quando configurado)

## 🚀 Uso no Código

```typescript
import { uploadProductImage } from '../../../services/uploadService';

// Upload de imagem
const result = await uploadProductImage(file);
if (result.success) {
  console.log('URL da imagem:', result.url);
  // http://localhost:3001/uploads/products/produto-123.jpg
}
```

## 📁 Estrutura de Arquivos

```
backend/
├── server.js              # Servidor Express principal
├── routes/
│   └── upload.js          # Rotas de upload
├── uploads/
│   └── products/          # Imagens dos produtos (criado automaticamente)
├── package.json
├── .env                   # Configurações
└── README.md
```

## 🔒 Validações

- **Tipos permitidos:** jpeg, png, webp, gif
- **Tamanho máximo:** 5MB (configurável)
- **Nome de arquivo:** Sanitizado automaticamente
- **Diretórios:** Criados automaticamente se não existirem

## 🐛 Troubleshooting

### Erro: EADDRINUSE (porta em uso)

```bash
# Mudar porta no .env
PORT=3002
```

### Erro: CORS blocked

```bash
# Adicionar URL do frontend no .env
FRONTEND_URL=http://localhost:3057
```

### Erro: Arquivo não encontrado após upload

- Verifique se o diretório `uploads/products/` foi criado
- Confirme que o backend está rodando na porta 3001
- Verifique a variável `VITE_BACKEND_URL` no frontend

## 📦 Deploy em Produção

### VPS (Nginx + PM2)

1. **Instalar PM2:**

```bash
npm install -g pm2
```

2. **Iniciar com PM2:**

```bash
cd backend
pm2 start server.js --name naturerva-backend
pm2 save
pm2 startup
```

3. **Configurar Nginx:**

```nginx
server {
    listen 80;
    server_name api.naturerva.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads {
        alias /caminho/para/backend/uploads;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

4. **Atualizar frontend .env:**

```env
VITE_BACKEND_URL=https://api.naturerva.com
```

## 🎯 Benefícios

✅ **100% Independente** - Sem dependência de serviços externos  
✅ **Controle Total** - Armazenamento na sua VPS  
✅ **Sem Custos** - Não paga por storage externo  
✅ **Rápido** - Imagens servidas diretamente do servidor  
✅ **Simples** - Código limpo e fácil de manter  
✅ **Escalável** - Adicione CDN depois se necessário  

---

**🌿 NaturErva ERP - Sistema 100% Independente**
