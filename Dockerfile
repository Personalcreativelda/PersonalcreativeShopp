# Stage 1: Build React frontend
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY front/ ./front/
COPY vite.config.ts ./
COPY tsconfig.json ./

ARG VITE_API_URL=/api

# Escreve o .env para o Vite ler na build
RUN echo "VITE_API_URL=${VITE_API_URL}" > .env.local

RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.25-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
