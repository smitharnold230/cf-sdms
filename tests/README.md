# Notification System Test Suite

This directory contains comprehensive tests for the notification system including rate limiting, monitoring, WebSocket functionality, and API endpoints.

## Test Structure

### Core Tests (`notification-simple.test.js`)
- **Rate Limiting Tests**: Verify rate limit enforcement, window resets, and error handling
- **Monitoring Tests**: Check metric recording, health monitoring, and alerting
- **Database Tests**: Validate notification CRUD operations and user preferences
- **Error Handling**: Ensure graceful failure handling and system resilience
- **Performance Tests**: Benchmark bulk operations and concurrent connections

### Integration Tests
- API endpoint validation with authentication
- WebSocket connection management
- Real-time notification delivery
- End-to-end user workflows

## Running Tests

### Prerequisites
```bash
cd tests
npm install
```

### Test Commands
```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Manual Testing

#### Rate Limiting
```bash
# Test rate limit enforcement
curl -X POST http://localhost:8787/api/notifications/send \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"userId": 123, "title": "Test", "message": "Test message"}'

# Repeat rapidly to trigger rate limit (429 response)
```

#### WebSocket Connection
```bash
# Test WebSocket connection
wscat -c "ws://localhost:8787/api/notifications/ws?token=your-token&userId=123"
```

#### Monitoring Endpoints
```bash
# Check system health (admin only)
curl -X GET http://localhost:8787/api/notifications/metrics \
  -H "Authorization: Bearer admin-token"
```

## Test Coverage Areas

### ✅ Completed Test Areas
- Rate limiting middleware functionality
- Notification monitoring and metrics collection
- Database error handling
- Basic authentication flow
- Mock environment setup

### 🔄 Areas for Enhancement
- WebSocket connection testing (requires real-time environment)
- Integration with actual Cloudflare Workers runtime
- Performance benchmarking with large datasets
- Email/SMS delivery testing with external services
- Frontend component integration tests

### 📊 Expected Test Results
- **Rate Limiting**: 100% coverage of limit enforcement and reset logic
- **Monitoring**: Metrics recording, health checks, and alert generation
- **Database Operations**: CRUD operations with proper error handling
- **Authentication**: Token validation and role-based access control
- **Performance**: Sub-second response times for bulk operations

## Mocking Strategy

The test suite uses comprehensive mocking for:
- **Database (D1)**: Simulated SQL operations and responses
- **KV Store**: Rate limiting data persistence
- **External APIs**: SendGrid, Twilio service calls
- **WebSockets**: Connection state and message handling

## Continuous Integration

These tests are designed to run in CI/CD pipelines with:
- Automated test execution on code changes
- Coverage reporting and quality gates
- Integration with GitHub Actions workflow
- Staging environment validation

## Troubleshooting

### Common Issues
1. **Import Errors**: Ensure proper module resolution for ES6/CommonJS
2. **Mock Failures**: Verify mock implementations match actual API contracts
3. **Timing Issues**: Use proper async/await patterns for database operations
4. **Environment Variables**: Configure test environment with required secrets

### Debug Mode
```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test notification-simple.test.js
```

## Contributing

When adding new tests:
1. Follow the existing naming conventions
2. Include both positive and negative test cases
3. Mock external dependencies appropriately
4. Add documentation for complex test scenarios
5. Update coverage expectations

## Performance Benchmarks

Target performance metrics:
- **API Response Time**: < 200ms for read operations
- **Rate Limit Check**: < 50ms per request
- **Notification Creation**: < 100ms per notification
- **Bulk Operations**: < 5 seconds for 1000 notifications
- **WebSocket Message**: < 10ms latency