FROM alpine:3.20

ARG POCKETBASE_VERSION=0.38.2
ARG TARGETARCH

RUN apk add --no-cache ca-certificates unzip wget \
  && case "${TARGETARCH}" in \
    amd64) PB_ARCH=amd64 ;; \
    arm64) PB_ARCH=arm64 ;; \
    *) echo "Unsupported architecture: ${TARGETARCH}" && exit 1 ;; \
  esac \
  && wget -O /tmp/pocketbase.zip "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_${PB_ARCH}.zip" \
  && unzip /tmp/pocketbase.zip -d /pb \
  && chmod +x /pb/pocketbase \
  && rm /tmp/pocketbase.zip

WORKDIR /pb
VOLUME ["/pb/pb_data"]
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8090/api/health >/dev/null || exit 1

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data"]
