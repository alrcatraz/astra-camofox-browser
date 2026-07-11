FROM node:22-slim AS camofox-browser

# Pinned Camoufox version for reproducible builds
# Update these when upgrading Camoufox
ARG CAMOUFOX_VERSION=135.0.1
ARG CAMOUFOX_RELEASE=beta.24
ARG ARCH=x86_64

# Install dependencies for Camoufox (Firefox-based)
RUN apt-get update && apt-get install -y \
    # Firefox dependencies
    libgtk-3-0 \
    libdbus-glib-1-2 \
    libxt6 \
    libasound2 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    # Mesa OpenGL/EGL for WebGL support (software rendering via llvmpipe)
    # Without these, Firefox cannot create WebGL contexts -- a major bot detection signal
    libegl1-mesa \
    libgl1-mesa-dri \
    libgbm1 \
    # Xvfb virtual display -- runs Camoufox as if on a real desktop (better anti-detection)
    xvfb \
    # Fonts
    fonts-liberation \
    fonts-noto-color-emoji \
    fontconfig \
    # Utils
    ca-certificates \
    curl \
    unzip \
    # yt-dlp runtime dependency
    python3-minimal \
    && rm -rf /var/lib/apt/lists/*

# Pre-bake Camoufox browser binary into image
# Note: unzip returns exit code 1 for warnings (Unicode filenames), so we use || true and verify
COPY dist/camoufox-${ARCH}.zip /tmp/camoufox.zip
RUN mkdir -p /root/.cache/camoufox \
    && (unzip -q /tmp/camoufox.zip -d /root/.cache/camoufox || true) \
    && chmod -R 755 /root/.cache/camoufox \
    && echo "{\"version\":\"${CAMOUFOX_VERSION}\",\"release\":\"${CAMOUFOX_RELEASE}\"}" > /root/.cache/camoufox/version.json \
    && rm /tmp/camoufox.zip \
    && test -f /root/.cache/camoufox/camoufox-bin && echo "Camoufox installed successfully"

# Install yt-dlp for YouTube transcript extraction (no browser needed)
COPY dist/yt-dlp-${ARCH} /usr/local/bin/yt-dlp
RUN chmod 755 /usr/local/bin/yt-dlp

WORKDIR /app

COPY package.json ./
COPY scripts/ ./scripts/
ENV npm_config_registry=https://registry.npmmirror.com
RUN npm install --production

# Pin playwright-core to v1.58.0 for Camoufox compatibility
# (v1.61.0+ sends isMobile in setDefaultViewport which Camoufox doesn't support)
RUN npm install playwright-core@1.58.0 --no-save 2>/dev/null && \
    echo "playwright-core@1.58.0 installed for Camoufox compatibility"

COPY server.js ./
COPY camofox.config.json ./
COPY lib/ ./lib/
COPY plugins/ ./plugins/
COPY scripts/ ./scripts/

# Install default plugin dependencies (apt packages + post-install hooks)
RUN sh scripts/install-plugin-deps.sh

ENV NODE_ENV=production
ENV CAMOFOX_PORT=9377
ENV ENABLE_VNC=1
ENV BROWSER_IDLE_TIMEOUT_MS=0

EXPOSE 9377
EXPOSE 5900

CMD ["sh", "-c", "node --max-old-space-size=${MAX_OLD_SPACE_SIZE:-128} server.js"]

# Optional: rebuild plugin deps after adding third-party plugins
# Usage: docker build --target with-plugins -t camofox-browser .
FROM camofox-browser AS with-plugins
COPY plugins/ ./plugins/
COPY camofox.config.json ./
COPY scripts/install-plugin-deps.sh /tmp/install-plugin-deps.sh
RUN /tmp/install-plugin-deps.sh && rm /tmp/install-plugin-deps.sh
