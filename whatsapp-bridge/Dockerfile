FROM ghcr.io/puppeteer/puppeteer:24.31.0

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

USER root
RUN mkdir -p /data && chown -R pptruser:pptruser /data /app
USER pptruser

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
EXPOSE 3000

CMD ["npm", "start"]
