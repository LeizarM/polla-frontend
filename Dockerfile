FROM node:22-alpine

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./

RUN corepack enable && yarn install

COPY . .

EXPOSE 8081

CMD npx expo start --web --port 8081 --non-interactive
