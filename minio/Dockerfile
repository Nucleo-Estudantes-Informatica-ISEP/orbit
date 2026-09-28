FROM golang:1.24.8-alpine AS build

RUN CGO_ENABLED=0 go install github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z \
    && cp /go/pkg/mod/github.com/minio/minio@*/LICENSE /tmp/LICENSE

FROM alpine:3.22

RUN apk add --no-cache ca-certificates
COPY --from=build /go/bin/minio /usr/local/bin/minio
COPY --from=build /tmp/LICENSE /licenses/LICENSE

ENTRYPOINT ["minio"]
