FROM node:20-alpine

WORKDIR /app

# Contexto de build é a raiz do projecto (definido no docker-compose.yml)
# Instalar dependências primeiro (melhor cache de layers)
COPY backend/package.json ./
RUN npm install --omit=dev

# Copiar código do backend
COPY backend/ ./

# Copiar ficheiros SQL para dentro do container (/app/sql/)
COPY sql/ ./sql/

# Directório de uploads
RUN mkdir -p uploads

EXPOSE 3060

CMD ["node", "server.js"]
