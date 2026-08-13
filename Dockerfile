FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=6969 HOSTNAME=0.0.0.0
RUN mkdir -p /app/data && chown -R node:node /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/data ./data
USER node
EXPOSE 6969
CMD ["node", "server.js"]
