# MinIO community images are no longer publicly available. Build the same
# RELEASE.2025-09-07T16-13-09Z from its immutable upstream source instead.
FROM golang:1.26-bookworm AS builder
WORKDIR /src
ADD --checksum=sha256:8819e3e7817e46b7b3798f8f200ead208562e571563c2e040352378031abe9f2 https://codeload.github.com/minio/minio/tar.gz/07c3a429bfed433e49018cb0f78a52145d4bedeb /tmp/minio.tar.gz
RUN tar -xzf /tmp/minio.tar.gz --strip-components=1 -C /src
ENV CGO_ENABLED=0
RUN go build -mod=readonly -p 2 -trimpath -ldflags "-s -w -X github.com/minio/minio/cmd.Version=2025-09-07T16:13:09Z -X github.com/minio/minio/cmd.ReleaseTag=RELEASE.2025-09-07T16-13-09Z -X github.com/minio/minio/cmd.CommitID=07c3a429bfed433e49018cb0f78a52145d4bedeb -X github.com/minio/minio/cmd.ShortCommitID=07c3a429bfed" -o /out/minio .
# Use the client already pinned by the server's go.mod/go.sum for mc ready.
RUN go build -mod=readonly -p 2 -trimpath -ldflags "-s -w" -o /out/mc github.com/minio/mc

FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /out/minio /out/mc /usr/bin/
COPY --from=builder /src/dockerscripts/docker-entrypoint.sh /usr/bin/docker-entrypoint.sh
COPY --from=builder /src/LICENSE /licenses/MinIO-LICENSE
RUN chmod 755 /usr/bin/docker-entrypoint.sh
EXPOSE 9000 9001
VOLUME ["/data"]
ENTRYPOINT ["/usr/bin/docker-entrypoint.sh"]
CMD ["minio"]
