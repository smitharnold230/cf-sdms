# Student Database Management System (Cloudflare Workers)

A comprehensive serverless Student DB Management REST API built on Cloudflare Workers with:

- D1 (SQLite) for complex relational data with events, workshops, points tracking
- R2 for PDF certificate object storage
- JWT authentication (HS256) & role-based access control (Admin / Faculty / Student)
- Password hashing via PBKDF2 (WebCrypto)
- Validation using Zod
- RESTful CRUD endpoints for Users, Certificates, Events, and Analytics
- Advanced dashboard and analytics capabilities
- Certificate approval workflow with notifications

## Tech Stack
- Cloudflare Workers + Wrangler
- D1 Database (SQLite)
- R2 Object Storage
- TypeScript
- itty-router
- zod

## Features

### Core Functionality
- **User Management**: Role-based user system with Admin, Faculty, and Student roles
- **Authentication**: JWT-based authentication with proper role-based access control
- **Certificate Management**: Upload, review, approve/reject certificate submissions
- **Event & Workshop Management**: Create events and workshops with deadlines and point awards
- **Points System**: Automatic point calculation and tracking for approved certificates
- **Notifications**: Real-time notification system for submissions and approvals

### New API Endpoints
- **POST /api/auth/login**: Enhanced login with JWT token generation
- **GET /api/student/dashboard**: Comprehensive student dashboard with points and deadlines
- **POST /api/faculty/events**: Create events and workshops
- **PUT /api/faculty/approve/:id**: Approve/reject certificate submissions
- **GET /api/admin/analytics**: System-wide analytics and reporting

## Environment & Bindings
Defined in `wrangler.toml`:

```
DB (D1)
CERT_BUCKET (R2)
JWT_SECRET (secret) - set via: wrangler secret put JWT_SECRET
JWT_ALG (env var) default HS256
TOKEN_TTL_SECONDS (env var) default 3600
```

```
DB (D1)
CERT_BUCKET (R2)
JWT_SECRET (secret) - set via: wrangler secret put JWT_SECRET
JWT_ALG (env var) default HS256
TOKEN_TTL_SECONDS (env var) default 3600
```

## Setup (PowerShell on Windows)

```powershell
# Install dependencies
npm install

# Login to Cloudflare (if not already)
wrangler login

# Create D1 database (if not created)
wrangler d1 create student_db
# Update wrangler.toml with the resulting database_id

# Create R2 bucket
wrangler r2 bucket create student-certificates

# Set JWT secret
wrangler secret put JWT_SECRET
# (Enter a strong random value)

# Apply migrations
npm run migrate:apply

# Dev server
npm run dev
```

## Migrations
Add new SQL migration files under `migrations/` then run:
```powershell
npm run migrate:apply
```

## API Overview
Base URL shown by `wrangler dev` or your deployed worker.

### New Enhanced API Endpoints

#### Authentication
| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | /auth/register | Register new (default student) user | No |
| POST | /auth/login | Login and obtain JWT | No |
| POST | /api/auth/login | Enhanced login with detailed response | No |

#### Student Dashboard
| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | /api/student/dashboard | Get comprehensive dashboard with points, certificates, deadlines | Student |

#### Faculty & Event Management
| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | /api/faculty/events | Create new event | Faculty/Admin |
| POST | /api/faculty/workshops | Create workshop for event | Faculty/Admin |
| GET | /api/events | List all events with details | Yes |

#### Certificate Approval
| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | /api/faculty/pending | Get pending certificate submissions | Faculty/Admin |
| PUT | /api/faculty/approve/:id | Approve certificate submission | Faculty/Admin |
| PUT | /api/faculty/reject/:id | Reject certificate with feedback | Faculty/Admin |

#### Analytics & Reporting
| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | /api/admin/analytics | System-wide analytics and metrics | Admin |
| GET | /api/analytics/user | User-specific analytics (own or specified) | Yes |

### Legacy API Endpoints

#### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/register | Register new (default student) user |
| POST | /auth/login | Login and obtain JWT |

Request examples:
```powershell
# Register
curl -X POST "${BASE}/auth/register" -H "Content-Type: application/json" -d '{"email":"stud1@example.com","password":"Password123!","full_name":"Student One"}'

# Login
curl -X POST "${BASE}/auth/login" -H "Content-Type: application/json" -d '{"email":"stud1@example.com","password":"Password123!"}'
```
Response (login):
```json
{"token":"<JWT>","user":{"id":1,"email":"stud1@example.com","role":"student","full_name":"Student One"}}
```

Include the token:
```
Authorization: Bearer <JWT>
```

### Users (Admin restricted except self GET/PUT)
| Method | Path | Notes |
|--------|------|-------|
| GET | /users | Admin only |
| GET | /users/:id | Self or Admin |
| PUT | /users/:id | Self or Admin (role change Admin only) |
| DELETE | /users/:id | Admin only |

### Certificates
| Method | Path | Notes |
|--------|------|-------|
| POST | /certificates/upload?user_id=ID&title=Title&issued_date=YYYY-MM-DD | Student only self; Faculty/Admin any |
| GET | /users/:id/certificates | Self or Faculty/Admin |
| GET | /certificates/:id/download | Owner or Faculty/Admin (simplified) |
| DELETE | /certificates/:id | Faculty/Admin |

## Testing

A comprehensive test script is included to validate all endpoints:

```powershell
# Install Node.js dependencies for testing
npm install

# Run the test script (update BASE_URL in the script first)
node test-endpoints.js
```

The test script validates:
- Authentication flow
- Dashboard functionality  
- Event and workshop creation
- Certificate approval workflow
- Analytics endpoints
- Error handling and permissions

## API Documentation

See `API_ENDPOINTS.md` for detailed documentation of all new endpoints including:
- Request/response schemas
- Authentication requirements
- Error codes and handling
- Example requests and responses

## Database Schema

The system uses a comprehensive relational schema including:
- **users**: User accounts with role-based access
- **certificates**: Certificate submissions with approval workflow
- **events**: Events and conferences
- **workshops**: Workshop sessions with deadlines and points
- **points**: Point tracking system for achievements
- **notifications**: Real-time notification system

See migration files in `migrations/` for complete schema details.

Upload example (PowerShell using Invoke-RestMethod):
```powershell
Invoke-RestMethod -Method Post -Uri "$BASE/certificates/upload?user_id=1&title=English%20Cert" `
  -Headers @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/pdf" } `
  -InFile .\certificate.pdf
```

### Error Format
```json
{ "error": "CODE", "message": "Human readable", "details": {...optional} }
```

## Role Logic Summary
- Admin: full access
- Faculty: manage & view certificates for any user, list/view users (except creating new via this API as implemented). Adjust as needed.
- Student: only their own user resource & upload/list their certificates

## Development Notes
- PBKDF2 iterations: 100k (adjust for performance budget)
- JWT HS256: rotate secret periodically
- Add rate limiting / audit logging as enhancements

## Deployment
```powershell
npm run deploy
```

## Next Enhancements
- Add pagination & search
- Add refresh tokens / revoke list
- Add certificate metadata updates
- Add tests & CI

## License
MIT (add LICENSE file if desired)
