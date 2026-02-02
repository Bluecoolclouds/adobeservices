FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/public ./client/public
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/shared ./shared

EXPOSE 5000

CMD ["npm", "start"]
