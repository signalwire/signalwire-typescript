# Use the official Node.js runtime as the base image
FROM node:22-slim

# Set working directory in container
WORKDIR /app

# Copy the package files first, so the dependency layer is cached
COPY package.json package-lock.json ./

# Install the dependencies, including tsx, which runs fred.ts
RUN npm ci && npm cache clean --force

# Copy Fred application
COPY fred.ts ./

# Run as the unprivileged node user the image provides. The files stay owned
# by root, so Fred can read its code but not change it.
USER node

# Expose the port Fred runs on
EXPOSE 3000

# Health check: /fred/health needs no credentials. The check fails when Fred
# doesn't answer, or answers with a status outside 200 to 299.
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/fred/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

# Run Fred in one process, so it receives the stop signal itself
CMD ["node", "--import", "tsx", "fred.ts"]
