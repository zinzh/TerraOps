# Stage 1: Build environment
FROM golang:1.23-alpine AS builder

# Install git (needed for go mod download) and Air (for hot-reloading)
RUN apk update && apk add --no-cache git build-base

# Set the working directory
WORKDIR /app

# Install Air for hot-reloading
RUN go install github.com/air-verse/air@latest

# Copy go module files
COPY go.mod go.sum ./
# Download dependencies first to leverage Docker cache
RUN go mod download

# Copy the source code
COPY . .

# Build the application (optional, Air can build too, but good for verifying)
# We'll run using Air in development via docker-compose command override
RUN go build -o /app/main .


# Stage 2: Final stage (leaner image if we weren't using Air)
# For development with Air, we often just use the builder stage or a slightly modified version
# If building a pure production image WITHOUT air, it would look like:
# FROM alpine:latest
# WORKDIR /root/
# COPY --from=builder /app/main .
# EXPOSE 8080
# CMD ["./main"]

# For Development with Air, we stick with the builder image base as Air needs Go tools
# Or create a separate dev stage inheriting from builder

WORKDIR /app

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application using Air for hot-reloading
# This will be overridden in docker-compose for development usually,
# but serves as a sensible default. Or use CMD ["/app/main"] if not using Air by default.
CMD ["air", "-c", ".air.toml"]