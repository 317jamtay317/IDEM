# syntax=docker/dockerfile:1.7
#
# Multi-stage build for RecordKeeping.Api.
#
# Stage 1 (client-build): builds the React/Vite SPA with Node.
# Stage 2 (api-build):    restores + publishes the .NET API. The client dist
#                          from stage 1 is staged into wwwroot before publish,
#                          and SkipClientBuild=true bypasses the MSBuild target
#                          that would otherwise try to invoke npm.
# Stage 3 (runtime):      slim ASP.NET runtime image carrying the published
#                          output. This is what gets pushed to the registry.
#
# Build context: repository root (so the Dockerfile can see both src/client
# and the .NET solution).

# ---- Stage 1: build the React client ----
FROM node:20-alpine AS client-build
WORKDIR /client

# package*.json first for layer-cache hits on dep-only changes.
COPY src/client/package.json src/client/package-lock.json* ./
RUN npm ci

COPY src/client/ ./
RUN npm run build
# Output: /client/dist


# ---- Stage 2: restore + publish the .NET API ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src

# Copy csproj/slnx first for restore-layer caching.
COPY RecordKeeping.slnx global.json ./
COPY src/RecordKeeping.Domain/RecordKeeping.Domain.csproj            src/RecordKeeping.Domain/
COPY src/RecordKeeping.Application/RecordKeeping.Application.csproj  src/RecordKeeping.Application/
COPY src/RecordKeeping.Infrastructure/RecordKeeping.Infrastructure.csproj src/RecordKeeping.Infrastructure/
COPY src/RecordKeeping.Mcp/RecordKeeping.Mcp.csproj                  src/RecordKeeping.Mcp/
COPY src/RecordKeeping.Api/RecordKeeping.Api.csproj                  src/RecordKeeping.Api/
RUN dotnet restore src/RecordKeeping.Api/RecordKeeping.Api.csproj

# Copy the rest of the .NET source.
COPY src/RecordKeeping.Domain/         src/RecordKeeping.Domain/
COPY src/RecordKeeping.Application/    src/RecordKeeping.Application/
COPY src/RecordKeeping.Infrastructure/ src/RecordKeeping.Infrastructure/
COPY src/RecordKeeping.Mcp/            src/RecordKeeping.Mcp/
COPY src/RecordKeeping.Api/            src/RecordKeeping.Api/

# Stage the pre-built client into wwwroot so publish picks it up via the
# standard static-files convention, and skip the MSBuild target that would
# re-run npm (this image has no Node).
COPY --from=client-build /client/dist/ src/RecordKeeping.Api/wwwroot/

RUN dotnet publish src/RecordKeeping.Api/RecordKeeping.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:SkipClientBuild=true


# ---- Stage 3: runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# curl is used by the docker-compose healthchecks (the base image ships without it).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=api-build /app/publish ./

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080 \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_USE_POLLING_FILE_WATCHER=false

ENTRYPOINT ["dotnet", "RecordKeeping.Api.dll"]
