FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY public ./public
COPY src ./src

RUN mkdir -p /app/uploads

EXPOSE 4040

CMD ["npm", "start"]
