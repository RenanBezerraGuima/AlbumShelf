# Stage 1: Build
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install dependencies
COPY go.mod go.sum ./
RUN go mod download

# Install templ
RUN go install github.com/a-h/templ/cmd/templ@latest

# Copy source
COPY . .

# Generate templates
RUN templ generate

# Build
RUN go build -o server ./cmd/server/main.go

# Stage 2: Final
FROM alpine:latest

WORKDIR /app

# Install sqlite for the database
RUN apk add --no-cache sqlite-libs ca-certificates

# Copy binary and static assets
COPY --from=builder /app/server .
COPY --from=builder /app/static ./static

# Expose port
EXPOSE 3000

# Run the server
CMD ["./server"]
