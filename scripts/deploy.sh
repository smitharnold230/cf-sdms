#!/bin/bash

# Deployment script for the notification system
# This script handles environment-specific configuration and deployment

set -e  # Exit on any error

ENVIRONMENT=${1:-development}
VALID_ENVIRONMENTS=("development" "staging" "production")

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Validate environment
if [[ ! " ${VALID_ENVIRONMENTS[@]} " =~ " ${ENVIRONMENT} " ]]; then
    log_error "Invalid environment: ${ENVIRONMENT}"
    log_info "Valid environments: ${VALID_ENVIRONMENTS[*]}"
    exit 1
fi

log_info "Starting deployment to ${ENVIRONMENT} environment..."

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI not found. Please install it: npm install -g wrangler"
        exit 1
    fi
    
    # Check if authenticated
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare. Run: wrangler login"
        exit 1
    fi
    
    # Check required environment variables
    required_vars=(
        "CLOUDFLARE_API_TOKEN"
        "CLOUDFLARE_ACCOUNT_ID"
        "JWT_SECRET"
        "SENDGRID_API_KEY"
        "TWILIO_ACCOUNT_SID"
        "TWILIO_AUTH_TOKEN"
    )
    
    for var in "${required_vars[@]}"; do
        env_var="${var}_${ENVIRONMENT^^}"
        if [[ -z "${!env_var}" ]]; then
            log_warning "Environment variable ${env_var} not set"
        fi
    done
    
    log_success "Prerequisites check completed"
}

# Setup infrastructure
setup_infrastructure() {
    log_info "Setting up infrastructure for ${ENVIRONMENT}..."
    
    local db_name="student-db"
    local kv_name="RATE_LIMIT_KV"
    local bucket_name="student-certificates"
    
    if [[ "${ENVIRONMENT}" != "production" ]]; then
        db_name="${db_name}-${ENVIRONMENT}"
        bucket_name="${bucket_name}-${ENVIRONMENT}"
    fi
    
    # Create D1 database
    log_info "Creating D1 database: ${db_name}"
    wrangler d1 create "${db_name}" || log_warning "Database may already exist"
    
    # Create KV namespace
    log_info "Creating KV namespace: ${kv_name}"
    if [[ "${ENVIRONMENT}" == "production" ]]; then
        wrangler kv:namespace create "${kv_name}" || log_warning "KV namespace may already exist"
    else
        wrangler kv:namespace create "${kv_name}" --preview || log_warning "KV namespace may already exist"
    fi
    
    # Create R2 bucket
    log_info "Creating R2 bucket: ${bucket_name}"
    wrangler r2 bucket create "${bucket_name}" || log_warning "R2 bucket may already exist"
    
    log_success "Infrastructure setup completed"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    local db_name="student-db"
    if [[ "${ENVIRONMENT}" != "production" ]]; then
        db_name="${db_name}-${ENVIRONMENT}"
    fi
    
    # Apply migrations in order
    for migration_file in migrations/*.sql; do
        if [[ -f "${migration_file}" ]]; then
            log_info "Applying migration: $(basename ${migration_file})"
            wrangler d1 execute "${db_name}" --file="${migration_file}"
        fi
    done
    
    log_success "Database migrations completed"
}

# Deploy application
deploy_application() {
    log_info "Deploying application to ${ENVIRONMENT}..."
    
    # Create environment-specific wrangler config
    local config_file="wrangler.${ENVIRONMENT}.toml"
    cp wrangler.toml "${config_file}"
    
    # Update worker name for non-production environments
    if [[ "${ENVIRONMENT}" != "production" ]]; then
        sed -i.bak "s/name = \"student-db-ms\"/name = \"student-db-ms-${ENVIRONMENT}\"/" "${config_file}"
    fi
    
    # Deploy with environment-specific config
    if [[ "${ENVIRONMENT}" == "production" ]]; then
        wrangler deploy
    else
        wrangler deploy --config "${config_file}"
    fi
    
    # Cleanup temporary config file
    rm -f "${config_file}" "${config_file}.bak"
    
    log_success "Application deployment completed"
}

# Run post-deployment tests
run_tests() {
    log_info "Running post-deployment tests..."
    
    local base_url
    if [[ "${ENVIRONMENT}" == "production" ]]; then
        base_url="https://student-db-ms.yourdomain.workers.dev"
    else
        base_url="https://student-db-ms-${ENVIRONMENT}.yourdomain.workers.dev"
    fi
    
    # Wait for deployment to propagate
    log_info "Waiting for deployment to propagate..."
    sleep 30
    
    # Health check
    log_info "Running health check..."
    if curl -f "${base_url}/health" &> /dev/null; then
        log_success "Health check passed"
    else
        log_error "Health check failed"
        return 1
    fi
    
    # Test notification endpoints (if not production)
    if [[ "${ENVIRONMENT}" != "production" ]]; then
        log_info "Testing notification endpoints..."
        
        # Test rate limiting (should get 429 after multiple requests)
        local rate_limit_test=false
        for i in {1..15}; do
            response_code=$(curl -s -o /dev/null -w "%{http_code}" \
                "${base_url}/api/notifications/send" \
                -H "Authorization: Bearer test-token" \
                -H "Content-Type: application/json" \
                -d '{"userId": 1, "title": "Test", "message": "Test"}' || echo "000")
            
            if [[ "${response_code}" == "429" ]]; then
                rate_limit_test=true
                break
            fi
            sleep 1
        done
        
        if [[ "${rate_limit_test}" == true ]]; then
            log_success "Rate limiting test passed"
        else
            log_warning "Rate limiting test inconclusive"
        fi
    fi
    
    log_success "Post-deployment tests completed"
}

# Monitor deployment
monitor_deployment() {
    if [[ "${ENVIRONMENT}" == "production" ]]; then
        log_info "Starting production monitoring..."
        
        local base_url="https://student-db-ms.yourdomain.workers.dev"
        local end_time=$(($(date +%s) + 300))  # Monitor for 5 minutes
        
        while [[ $(date +%s) -lt ${end_time} ]]; do
            if curl -s -f "${base_url}/health" &> /dev/null; then
                log_success "Health check passed at $(date)"
            else
                log_error "Health check failed at $(date)"
                return 1
            fi
            sleep 30
        done
        
        log_success "Production monitoring completed"
    fi
}

# Send notifications
send_notifications() {
    if [[ "${ENVIRONMENT}" == "production" && -n "${SLACK_WEBHOOK_URL}" ]]; then
        log_info "Sending deployment notification..."
        
        curl -X POST "${SLACK_WEBHOOK_URL}" \
            -H 'Content-type: application/json' \
            -d "{\"text\":\"✅ Notification system deployed to ${ENVIRONMENT} successfully! Commit: $(git rev-parse --short HEAD)\"}" \
            &> /dev/null || log_warning "Failed to send Slack notification"
    fi
}

# Main deployment flow
main() {
    echo "🚀 Notification System Deployment Script"
    echo "========================================"
    
    check_prerequisites
    setup_infrastructure
    run_migrations
    deploy_application
    run_tests
    monitor_deployment
    send_notifications
    
    log_success "Deployment to ${ENVIRONMENT} completed successfully! 🎉"
    
    if [[ "${ENVIRONMENT}" == "production" ]]; then
        echo ""
        echo "🌐 Production URL: https://student-db-ms.yourdomain.workers.dev"
        echo "📊 Admin Dashboard: https://student-db-ms.yourdomain.workers.dev/admin"
        echo "📚 API Documentation: https://student-db-ms.yourdomain.workers.dev/docs"
    fi
}

# Error handling
trap 'log_error "Deployment failed at line $LINENO. Check the logs above for details."' ERR

# Run main function
main "$@"