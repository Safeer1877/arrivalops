FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 ARRIVALOPS_DATA_DIR=/data
COPY --from=build /app ./
RUN mkdir -p /data
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
