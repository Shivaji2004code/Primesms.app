#!/bin/bash

# ============================================================================
# Prime SMS Production Deployment Script
# ============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if .env exists
if [ ! -f .env ]; then
    log_warning ".env file not found. Creating from .env.example..."
    cp .env.example .env
    log_warning "Please update .env file with your production values before running again!"
    exit 1
fi

# Load environment variables
source .env

# Validate required environment variables
REQUIRED_VARS=(
    "DATABASE_URL"
    "SESSION_SECRET"
    "POSTGRES_PASSWORD"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        log_error "Required environment variable $var is not set in .env"
        exit 1
    fi
done

log_info "Starting Prime SMS deployment..."

# Step 1: Build the application
log_info "Building Prime SMS application..."
docker-compose build --no-cache

log_success "Application built successfully"

# Step 2: Start the database first
log_info "Starting database services..."
docker-compose up -d postgres redis

# Wait for database to be ready
log_info "Waiting for database to be ready..."
sleep 10

# Check database health
if docker-compose exec postgres pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-PrimeSMS_W}; then
    log_success "Database is ready"
else
    log_error "Database failed to start"
    exit 1
fi

# Step 3: Run database migrations if needed
log_info "Database schema will be initialized automatically"

# Step 4: Start the application
log_info "Starting Prime SMS application..."
docker-compose up -d app

# Wait for application to be ready
log_info "Waiting for application to start..."
sleep 15

# Step 5: Health check
log_info "Performing health check..."
if curl -f http://localhost:${PORT:-3000}/healthz > /dev/null 2>&1; then
    log_success "Application is healthy and running"
else
    log_error "Application health check failed"
    log_info "Checking application logs..."
    docker-compose logs app --tail=50
    exit 1
fi

# Step 6: Display deployment information
log_success "🚀 Prime SMS deployed successfully!"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 Prime SMS WhatsApp Business API - Production Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "🌐 Application URL:     http://localhost:${PORT:-3000}"
echo "🏥 Health Check:        http://localhost:${PORT:-3000}/healthz"
echo "📊 Metrics:             http://localhost:${PORT:-3000}/api/metrics"
echo "📋 Version Info:        http://localhost:${PORT:-3000}/version"
echo "🗄️  Database:            PostgreSQL on port ${POSTGRES_PORT:-5432}"
echo "🔴 Redis:               Redis on port ${REDIS_PORT:-6379}"
echo
echo "💰 Pricing System:      Enabled with INR currency"
echo "   • Marketing:         ₹${PRICING_DEFAULT_MARKETING:-0.80} per message"
echo "   • Utility:           ₹${PRICING_DEFAULT_UTILITY:-0.15} per message"  
echo "   • Authentication:    ₹${PRICING_DEFAULT_AUTHENTICATION:-0.15} per message"
echo
echo "🔧 Management Commands:"
echo "   • View logs:         docker-compose logs -f app"
echo "   • Stop services:     docker-compose down"
echo "   • Update app:        ./deploy.sh"
echo "   • Database shell:    docker-compose exec postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-PrimeSMS_W}"
echo "   • Redis CLI:         docker-compose exec redis redis-cli"
echo
echo "🚨 Important Notes:"
echo "   • Update CORS_ORIGINS in .env for production"
echo "   • Change default passwords in .env"
echo "   • Configure your domain/SSL in reverse proxy"
echo "   • Monitor logs and health endpoints"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Optional: Show running containers
log_info "Running containers:"
docker-compose ps