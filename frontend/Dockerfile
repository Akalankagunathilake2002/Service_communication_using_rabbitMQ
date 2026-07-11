FROM node:20-slim AS deps
WORKDIR /srv
COPY package.json ./
RUN npm install

FROM node:20-slim AS builder
WORKDIR /srv
COPY --from=deps /srv/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /srv
ENV NODE_ENV=production

COPY --from=builder /srv/public ./public
COPY --from=builder /srv/.next ./.next
COPY --from=builder /srv/node_modules ./node_modules
COPY --from=builder /srv/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
