FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd
ARG APP_BUILD_ID
ARG APP_COMMIT_SHA
ARG APP_CREATED_AT
ARG FAIL_MODE=0
LABEL org.opencontainers.image.version=$APP_BUILD_ID \
    org.opencontainers.image.revision=$APP_COMMIT_SHA \
    org.opencontainers.image.created=$APP_CREATED_AT
WORKDIR /app
ENV FAIL_MODE=$FAIL_MODE
COPY tests/release/server.mjs ./server.mjs
COPY scripts/release/smoke.mjs ./release/smoke.mjs
COPY public/models.manifest.json ./release/models.manifest.json
USER node
CMD ["node", "server.mjs"]
