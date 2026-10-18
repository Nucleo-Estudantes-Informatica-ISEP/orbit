FROM alpine:3.23

ARG TARGETARCH

# Official release assets, pinned to the server version previously used by Compose.
# Digests are published by the minio/minio and minio/mc GitHub releases.
RUN apk add --no-cache ca-certificates \
    && case "$TARGETARCH" in \
        amd64) \
            minio_sha=7c5bd8512c6e966455b1d198209358b2d191c77a83ab377c4073281065fb855f; \
            mc_sha=01f866e9c5f9b87c2b09116fa5d7c06695b106242d829a8bb32990c00312e891 ;; \
        arm64) \
            minio_sha=5c83cd2cf151717ba0243f73e1c7802ff36e272b67144bdd7f1f7d684fd6f03d; \
            mc_sha=14c8c9616cfce4636add161304353244e8de383b2e2752c0e9dad01d4c27c12c ;; \
        ppc64le) \
            minio_sha=bf2b20db16d1b9e598ffcaa8c775908b558512346f81d359437125a1f1048d13; \
            mc_sha=0cf8776e6e1b1e2cd8a5c9e43ab26a1e2fbe57f57f51c9d99accaee3b0a2152b ;; \
        *) echo "Unsupported MinIO architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac \
    && wget -q -O /usr/local/bin/minio "https://github.com/minio/minio/releases/download/RELEASE.2025-09-07T16-13-09Z/minio.linux-${TARGETARCH}.RELEASE.2025-09-07T16-13-09Z" \
    && echo "$minio_sha  /usr/local/bin/minio" | sha256sum -c - \
    && wget -q -O /usr/local/bin/mc "https://github.com/minio/mc/releases/download/RELEASE.2025-08-13T08-35-41Z/mc.linux-${TARGETARCH}.RELEASE.2025-08-13T08-35-41Z" \
    && echo "$mc_sha  /usr/local/bin/mc" | sha256sum -c - \
    && chmod 0755 /usr/local/bin/minio /usr/local/bin/mc \
    && minio --version \
    && mc --version

LABEL org.opencontainers.image.source="https://github.com/minio/minio" \
      org.opencontainers.image.version="RELEASE.2025-09-07T16-13-09Z" \
      org.opencontainers.image.licenses="AGPL-3.0-only"

EXPOSE 9000 9001
ENTRYPOINT ["/usr/local/bin/minio"]
CMD ["server", "/data"]
