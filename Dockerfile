FROM node:23

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production --ignore-scripts

COPY . .
COPY config.prod.js config.js

CMD [ "node", "app" ]