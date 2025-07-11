# https://bun.sh/guides/ecosystem/docker
FROM oven/bun:1.2.18@sha256:2cdd9c93006af1b433c214016d72a3c60d7aa2c75691cb44dfd5250aa379986b AS base

WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY package.json package.json
COPY src src

USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "start" ]

FROM release AS test

