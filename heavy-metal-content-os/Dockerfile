# Heavy Metal Content OS — production image
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=3000 HM_DATA_DIR=/data
# Mount a persistent disk at /data: it holds the database, PDFs and thumbnails.
VOLUME /data
EXPOSE 3000
CMD ["npm", "start"]
