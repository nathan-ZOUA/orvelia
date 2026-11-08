FROM node:20-alpine

WORKDIR /app

# Installation des dépendances et de Prisma
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --omit=dev || npm install --production
RUN npx prisma generate

# Copie du code applicatif et du frontend
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
