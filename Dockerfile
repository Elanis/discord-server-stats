FROM node:21

ARG NPM_TOKEN

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .
COPY config.prod.js config.js

CMD [ "node", "app" ]