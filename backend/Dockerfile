FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy source code (inclui storage/, routes/, middleware/)
COPY . .

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 3060

CMD ["node", "server.js"]
