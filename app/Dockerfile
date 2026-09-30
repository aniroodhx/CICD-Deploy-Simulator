# Small, reproducible image for the sample API.
FROM node:20-alpine

WORKDIR /app

# No third-party deps yet, but copy manifest first so this layer caches
# once we add real dependencies.
COPY package.json ./
COPY server.js ./

ENV PORT=8080
EXPOSE 8080

# Basic container-level healthcheck (mirrors the k8s probe).
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1

CMD ["node", "server.js"]
