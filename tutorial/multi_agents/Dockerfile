# PC Builder Pro multi-agent service (Lesson 4).
# Build context: a project whose package.json depends on @signalwire/sdk and tsx,
# with package-lock.json, pc_builder.ts, knowledge.ts and the two knowledge files.
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

# Install the locked dependencies first, so a code change reuses this layer
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the application
COPY pc_builder.ts knowledge.ts sales_knowledge.md support_knowledge.md ./

# Run as the image's unprivileged user
USER node

EXPOSE 3001

# Node has fetch built in, and the slim image has no curl
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["./node_modules/.bin/tsx", "pc_builder.ts"]
