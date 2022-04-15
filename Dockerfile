FROM node:16-slim AS base
RUN apt-get -q update && apt-get install libssl-dev ca-certificates -qy

WORKDIR /app
COPY package.json yarn.lock ./prisma ./
RUN yarn install --production
RUN yarn prisma generate

FROM base AS build
WORKDIR /app
RUN yarn install 
COPY . .
RUN yarn generate
RUN yarn build

FROM base
WORKDIR /app
COPY --from=build /app/dist /app/dist
COPY --from=build  /app/prisma /app/prisma
EXPOSE 80

CMD ["node", "dist/index.js"]
