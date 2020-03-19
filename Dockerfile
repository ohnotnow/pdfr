FROM node:lts-buster-slim

USER node
WORKDIR /home/node
COPY package* index.js /home/node/
RUN npm ci && npm cache clean --force
EXPOSE 3003
CMD ["node", "index.js"]

