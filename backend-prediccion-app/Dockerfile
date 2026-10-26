FROM node:20-slim AS builder

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .

# Generar cliente prisma y build de NestJS
RUN npx prisma generate
RUN npm run build

# ---
# Produccion
# ---
FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /usr/src/app

COPY package*.json ./

# Copiar build temporal y node_modules generados
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/prisma ./prisma

EXPOSE 3007

# El script start:prod suele referenciar dist/main
CMD ["node", "dist/main.js"]
