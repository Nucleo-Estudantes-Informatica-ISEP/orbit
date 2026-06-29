FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

ARG DATABASE_URL=postgresql://postgres:postgres@db:5432/orbit?schema=public
ENV DATABASE_URL=${DATABASE_URL}

# Install dependencies (including devDependencies) for build
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/orbit?schema=public

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Reuse the installed dependencies and generated Prisma client from the build stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/src/main"]
