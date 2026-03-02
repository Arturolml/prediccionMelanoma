FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Generar cliente prisma y build de NestJS
RUN npx prisma generate
RUN npm run build

# ---
# Produccion
# ---
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --only=production

# Copiar build temporal
COPY --from=builder /usr/src/app/dist ./dist
# Prisma SDK y Client son necesarios en runtime
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3007

# El script start:prod suele referenciar dist/main
CMD ["npm", "run", "start:prod"]
