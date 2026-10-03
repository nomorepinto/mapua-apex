FROM php:8.4-cli

# Set environment variables
ENV COMPOSER_ALLOW_SUPERUSER=1

# Install system dependencies and PHP extensions
RUN apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    libzip-dev \
    libonig-dev \
    libxml2-dev \
    libpng-dev \
    libicu-dev \
    && docker-php-ext-install \
    zip \
    mbstring \
    bcmath \
    xml \
    pdo \
    pdo_mysql \
    intl \
    pcntl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

# Copy project files
COPY . .

# Install production dependencies without running scripts prematurely
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist --no-scripts

# Create necessary storage folders and set permissions
RUN mkdir -p storage/framework/sessions \
    storage/framework/views \
    storage/framework/cache \
    storage/logs \
    bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

# Run discovery at startup when runtime environment variables are present, then start the server
CMD php artisan package:discover --ansi && php artisan serve --host=0.0.0.0 --port=${PORT:-10000}
