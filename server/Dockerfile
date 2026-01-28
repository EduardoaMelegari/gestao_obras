FROM node:22-alpine

WORKDIR /app

# Install dependencies (root package.json is used by server)
COPY package.json package-lock.json ./
RUN npm install

# Copy source code
COPY server/ ./server/

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose Port
EXPOSE 3000

# Start command
CMD ["node", "server/index.js"]
