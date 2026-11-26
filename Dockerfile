ARG NODE_VERSION=12
FROM node:${NODE_VERSION} AS build
ARG SITE
ARG BACKEND
ARG PHOTO_SOURCE
ARG PHOTO_BUCKET
ARG GOOGLE_MAPS_KEY
ARG GOOGLE_MAPS_ID
ARG LOCALES
ENV SITE=$SITE BACKEND=$BACKEND PHOTO_SOURCE=$PHOTO_SOURCE PHOTO_BUCKET=$PHOTO_BUCKET \
    GOOGLE_MAPS_KEY=$GOOGLE_MAPS_KEY GOOGLE_MAPS_ID=$GOOGLE_MAPS_ID LOCALES=$LOCALES
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN cp src/data/siteConfig.js.example src/data/siteConfig.js && npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/_dist/ /usr/share/nginx/html/
