# Stage 1: Build React frontend
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY front/ ./front/
COPY vite.config.ts ./
COPY tsconfig.json ./

ARG VITE_API_URL=/api
ARG VITE_MINIO_PUBLIC_URL
ARG VITE_MINIO_BUCKET=personalcreativeshop
ARG VITE_ADMIN_URL=/painel
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_META_PIXEL_ID
ARG VITE_GA_MEASUREMENT_ID

RUN echo "VITE_API_URL=${VITE_API_URL}" > .env.local && \
    echo "VITE_MINIO_PUBLIC_URL=${VITE_MINIO_PUBLIC_URL}" >> .env.local && \
    echo "VITE_MINIO_BUCKET=${VITE_MINIO_BUCKET}" >> .env.local && \
    echo "VITE_ADMIN_URL=${VITE_ADMIN_URL}" >> .env.local && \
    echo "VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}" >> .env.local && \
    echo "VITE_META_PIXEL_ID=${VITE_META_PIXEL_ID}" >> .env.local && \
    echo "VITE_GA_MEASUREMENT_ID=${VITE_GA_MEASUREMENT_ID}" >> .env.local

RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.25-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
