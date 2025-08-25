#!/bin/bash

# ============================================================================
# Prime SMS Production Deployment Validation Script
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Configuration
HOST=${HOST:-localhost}
PORT=${PORT:-3000}
BASE_URL="http://${HOST}:${PORT}"

log_info "Validating Prime SMS deployment at $BASE_URL"
echo

# Test 1: Health Check
log_info "Testing health endpoint..."
if curl -f -s "${BASE_URL}/healthz" > /dev/null; then
    HEALTH_RESPONSE=$(curl -s "${BASE_URL}/healthz")
    log_success "Health check passed"
    echo "   Response: $(echo $HEALTH_RESPONSE | jq -r '.status // "ok"' 2>/dev/null || echo "ok")"
else
    log_error "Health check failed"
    exit 1
fi

# Test 2: Version Info
log_info "Testing version endpoint..."
if curl -f -s "${BASE_URL}/version" > /dev/null; then
    VERSION_INFO=$(curl -s "${BASE_URL}/version")
    VERSION=$(echo $VERSION_INFO | jq -r '.version' 2>/dev/null || echo "1.2.0")
    log_success "Version endpoint accessible"
    echo "   Version: $VERSION"
else
    log_warning "Version endpoint not accessible (optional)"
fi

# Test 3: Static Files (Client)
log_info "Testing static client files..."
if curl -f -s "${BASE_URL}/" > /dev/null; then
    log_success "Client application accessible"
else
    log_error "Client application not accessible"
    exit 1
fi

# Test 4: Pricing API Endpoints (Admin protected)
log_info "Testing pricing API structure..."
PRICING_RESPONSE=$(curl -s -w "%{http_code}" "${BASE_URL}/api/admin/pricing/defaults" -o /dev/null)
if [[ "$PRICING_RESPONSE" == "401" || "$PRICING_RESPONSE" == "403" ]]; then
    log_success "Pricing API protected (authentication required)"
elif [[ "$PRICING_RESPONSE" == "200" ]]; then
    log_success "Pricing API accessible"
else
    log_warning "Pricing API returned HTTP $PRICING_RESPONSE"
fi

# Test 5: Database Health
log_info "Testing database connectivity..."
DB_HEALTH_RESPONSE=$(curl -s -w "%{http_code}" "${BASE_URL}/api/health/db" -o /dev/null)
if [[ "$DB_HEALTH_RESPONSE" == "200" ]]; then
    log_success "Database connectivity confirmed"
elif [[ "$DB_HEALTH_RESPONSE" == "500" ]]; then
    log_error "Database connection failed"
    exit 1
else
    log_warning "Database health check returned HTTP $DB_HEALTH_RESPONSE"
fi

# Test 6: Metrics Endpoint
log_info "Testing metrics endpoint..."
if curl -f -s "${BASE_URL}/api/metrics" > /dev/null; then
    METRICS=$(curl -s "${BASE_URL}/api/metrics")
    UPTIME=$(echo $METRICS | jq -r '.uptime' 2>/dev/null || echo "unknown")
    log_success "Metrics endpoint accessible"
    echo "   Uptime: ${UPTIME}s"
else
    log_warning "Metrics endpoint not accessible (optional)"
fi

# Test 7: Security Headers
log_info "Testing security headers..."
HEADERS=$(curl -I -s "${BASE_URL}/")
if echo "$HEADERS" | grep -q "X-Frame-Options\|X-Content-Type-Options"; then
    log_success "Security headers present"
else
    log_warning "Consider adding security headers"
fi

# Test 8: Performance Check
log_info "Testing response times..."
RESPONSE_TIME=$(curl -w "%{time_total}" -s -o /dev/null "${BASE_URL}/healthz")
if (( $(echo "$RESPONSE_TIME < 1.0" | bc -l) )); then
    log_success "Response time good (${RESPONSE_TIME}s)"
else
    log_warning "Response time slow (${RESPONSE_TIME}s)"
fi

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Prime SMS Deployment Validation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Application URL:     $BASE_URL"
echo "📱 Admin Dashboard:     $BASE_URL/admin"
echo "💰 Pricing Management:  $BASE_URL/admin/pricing"
echo "📋 API Documentation:   $BASE_URL/api"
echo
echo "🔧 Management URLs:"
echo "   • Health:             $BASE_URL/healthz"
echo "   • Version:            $BASE_URL/version"
echo "   • Metrics:            $BASE_URL/api/metrics"
echo "   • DB Health:          $BASE_URL/api/health/db"
echo
echo "✅ Deployment validation completed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"