# Stage 1: Build Next.js Frontend
FROM node:20-alpine AS next-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
# Set environment variables for the build
# NEXT_PUBLIC_BASE_PATH is set to empty to serve from root
ENV NEXT_PUBLIC_BASE_PATH=""
RUN pnpm build

# Stage 2: Build Go Backend
FROM golang:1.24-alpine AS go-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
RUN go install github.com/a-h/templ/cmd/templ@latest
COPY . .
# Generate templ files just in case, although they are checked in
RUN templ generate
RUN go build -o server ./cmd/server/main.go

# Stage 3: Final Image
FROM alpine:latest
WORKDIR /app
RUN apk add --no-cache sqlite-libs ca-certificates
COPY --from=go-builder /app/server .
COPY --from=go-builder /app/static ./static
COPY --from=next-builder /app/out ./out
EXPOSE 3000
CMD ["./server"]
