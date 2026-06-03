FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN mkdir -p data/uploads
EXPOSE 3000
CMD ["node", "server.js"]
