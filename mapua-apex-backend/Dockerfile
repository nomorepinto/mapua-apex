# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Production image for the mapua-apex Laravel backend, tuned for Render.
#
#  - Base: php:8.4-apache (mpm_prefork + mod_php, apache2-foreground as PID 1
#    → real SIGTERM handling, no supervisor needed).
#  - Two-layer dependency install: composer.lock copied first so vendor/
#    rebuilds only when the lockfile changes.
#  - Build-time: autoload optimization, package discovery, route + view cache.
#  - Runtime entrypoint: bakes Render env vars into config:cache, patches
#    Apache to listen on $PORT (Render injects it), then execs Apache.
#  - No .env inside the image; Laravel falls back to real env vars because
#    bootstrap/app.php's is_file() guard skips useEnvironmentPath() when the
#    master .env is absent (see monorepo note in bootstrap/app.php).
# ─────────────────────────────────────────────────────────────────────────────

FROM php:8.4-apache

# Non-interactive + Composer as root inside the build container.
ENV COMPOSER_ALLOW_SUPERUSER=1 \
    APACHE_RUN_USER=www-data \
    APACHE_RUN_GROUP=www-data \
    PORT=10000

# ── System packages + PHP extensions (single layer, cleaned afterwards) ──────
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        curl \
        unzip \
        libzip-dev \
        libonig-dev \
        libxml2-dev \
        libpng-dev \
        libicu-dev \
        libssl-dev \
        ca-certificates \
    && docker-php-ext-install -j"$(nproc)" \
        bcmath \
        intl \
        mbstring \
        opcache \
        pcntl \
        pdo \
        pdo_mysql \
        xml \
        zip \
    && a2enmod rewrite headers expires \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ── PHP production ini ───────────────────────────────────────────────────────
COPY <<'INI' /usr/local/etc/php/conf.d/zz-production.ini
expose_php = Off
memory_limit = 256M
upload_max_filesize = 25M
post_max_size = 26M
opcache.enable = 1
opcache.enable_cli = 0
opcache.memory_consumption = 128
opcache.max_accelerated_files = 20000
opcache.validate_timestamps = 0
realpath_cache_size = 4096K
realpath_cache_ttl = 600
INI

# ── Composer binary ──────────────────────────────────────────────────────────
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

# ── Layer 1: dependencies (cached on composer.lock change) ───────────────────
# Build context = mapua-apex-backend/ (Render's Docker Build Context setting),
# so all source paths here are relative to that folder.
COPY composer.json composer.lock ./
RUN composer install \
        --no-dev \
        --no-scripts \
        --no-autoloader \
        --prefer-dist \
        --optimize-autoloader \
        --no-interaction \
        --no-progress

# ── Layer 2: application source ──────────────────────────────────────────────
COPY . ./

# Autoload must be dumped after source lands; then run artisan steps that
# are env-independent. `config:cache` is intentionally NOT run here — it
# bakes env values at build time, which would freeze Render's placeholder
# env or the CI environment instead of production.
RUN composer dump-autoload --optimize --no-dev --classmap-authoritative \
    && php artisan package:discover --ansi \
    && php artisan route:cache \
    && php artisan view:cache \
    && rm -rf /var/www/.composer /root/.composer /tmp/*

# ── Apache vhost: Laravel front controller, logs to stdout/stderr ────────────
# ports.conf is templated (${PORT} substituted at start) because Apache does
# not expand env vars inside its own config files.
COPY <<'PORTS' /etc/apache2/ports.conf.template
Listen ${PORT}
PORTS

COPY <<'APPCONF' /etc/apache2/conf-available/zz-app.conf
ServerName localhost
ServerTokens Prod
ServerSignature Off
<Directory /var/www/public>
    Require all granted
    AllowOverride All
    Options -Indexes +FollowSymLinks
</Directory>
ErrorLog /proc/self/fd/2
CustomLog /proc/self/fd/1 combined
APPCONF

# Own vhost for the Laravel front controller. We deliberately do NOT sed the
# distro 000-default.conf's DocumentRoot — if that substitution ever no-ops
# (stale build cache, differing base image), Apache silently keeps serving the
# empty /var/www/html default and every route 404s before Laravel loads.
# Instead we disable the default site and enable our own, whose DocumentRoot is
# hard-coded to /var/www/public. The <VirtualHost *:PORT> tag is rendered from
# $PORT at container start (see docker-entrypoint).
COPY <<'VHOST' /etc/apache2/sites-available/mapua.conf
<VirtualHost *:PORT_PLACEHOLDER>
    DocumentRoot /var/www/public
</VirtualHost>
VHOST

RUN a2enconf zz-app \
    && a2disconf other-vhosts-access-log \
    && a2dissite 000-default.conf

# ── Writable paths for Laravel runtime ───────────────────────────────────────
RUN mkdir -p /var/www/storage/framework/{cache/data,sessions,testing,views} \
             /var/www/storage/logs \
             /var/www/bootstrap/cache \
    && chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache \
    && chmod -R 775 /var/www/storage /var/www/bootstrap/cache

# ── Entrypoint: bake env into Apache + Laravel config, then exec Apache ──────
COPY <<'ENTRY' /usr/local/bin/docker-entrypoint
#!/usr/bin/env sh
set -e
cd /var/www

# 1) Point Apache at Render-assigned $PORT (Render injects it at start).
#    Ports template -> ports.conf; our vhost template -> sites-enabled, with
#    the *:$PORT tag substituted so it matches the Listen directive.
PORT="${PORT:-10000}"
sed "s|\${PORT}|${PORT}|g" /etc/apache2/ports.conf.template > /etc/apache2/ports.conf
sed "s|PORT_PLACEHOLDER|${PORT}|g" \
    /etc/apache2/sites-available/mapua.conf > /etc/apache2/sites-enabled/mapua.conf

# 2) Bake runtime env into Laravel config (idempotent; safe on every restart).
php artisan config:cache >/dev/null || php artisan config:clear >/dev/null
php artisan event:cache  >/dev/null 2>&1 || true

# 3) Make sure writable paths are owned by the worker user.
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

exec "$@"
ENTRY
RUN chmod +x /usr/local/bin/docker-entrypoint

# apache2-foreground (from the php image) execs `apache2 -DFOREGROUND` as
# PID 1 — it inherits SIGTERM from the container runtime and shuts down
# cleanly. The default php:apache entrypoint is a shell script that would
# run before ours; override it.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint"]
CMD ["apache2-foreground"]

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/up" || exit 1
