FROM node:24-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY reservations.ts workflow.ts handlers.ts penny.ts ./

# Run as the image's unprivileged node user, and keep the reservation book on a volume.
RUN mkdir -p /data && chown node /data
USER node
ENV PENNY_DB_PATH=/data/penny.sqlite3
VOLUME /data

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s \
    CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/penny/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "--import", "tsx", "penny.ts"]
