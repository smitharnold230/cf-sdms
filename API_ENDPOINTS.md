# SDMS API Endpoints Documentation

## Overview
The Student Database Management System provides comprehensive API endpoints for authentication, dashboard functionality, event management, certificate approval, and analytics.

## Base URL
```
https://your-worker.your-subdomain.workers.dev
```

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## New API Endpoints

### 1. Authentication

#### POST /api/auth/login
Login endpoint with JWT token generation.

**Request Body:**
```json
{
  "email": "student@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "student@example.com",
    "role": "student",
    "full_name": "John Doe",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**Status Codes:**
- 200: Success
- 401: Invalid credentials
- 400: Validation error

---

### 2. Student Dashboard

#### GET /api/student/dashboard
Get comprehensive student dashboard data with points calculation.

**Authentication:** Required (Student role)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPoints": 150,
    "approvedCertificates": 5,
    "pendingCertificates": 2,
    "rejectedCertificates": 1,
    "certificates": [
      {
        "id": 1,
        "title": "Workshop Certificate",
        "description": "Certificate for completing workshop",
        "submission_date": "2024-01-15T10:00:00Z",
        "status": "approved",
        "review_feedback": "Well done!",
        "points_awarded": 30,
        "workshop_title": "Data Science Workshop",
        "event_title": "Tech Conference 2024"
      }
    ],
    "upcomingWorkshops": [
      {
        "id": 2,
        "title": "AI Workshop",
        "description": "Introduction to AI",
        "submission_deadline": "2024-02-15T23:59:59Z",
        "points_awarded": 40,
        "event_title": "AI Summit 2024",
        "location": "Tech Hub"
      }
    ],
    "notifications": [
      {
        "id": 1,
        "type": "certificate_approved",
        "title": "Certificate Approved",
        "message": "Your certificate has been approved and points have been awarded.",
        "read_status": false,
        "created_at": "2024-01-16T09:00:00Z"
      }
    ],
    "pointsHistory": [
      {
        "month": "2024-01",
        "points_earned": 150,
        "certificates_approved": 5
      }
    ]
  }
}
```

---

### 3. Faculty Event Management

#### POST /api/faculty/events
Create a new event (Faculty/Admin only).

**Authentication:** Required (Faculty or Admin role)

**Request Body:**
```json
{
  "title": "Tech Conference 2024",
  "description": "Annual technology conference",
  "start_date": "2024-03-01T09:00:00Z",
  "end_date": "2024-03-01T17:00:00Z",
  "location": "Tech Hub Auditorium",
  "max_participants": 100
}
```

**Response:**
```json
{
  "success": true,
  "message": "Event created successfully",
  "eventId": 5
}
```

#### POST /api/faculty/workshops?eventId=5
Create a workshop for an existing event (Faculty/Admin only).

**Authentication:** Required (Faculty or Admin role)

**Request Body:**
```json
{
  "title": "Data Science Workshop",
  "description": "Hands-on data science training",
  "submission_deadline": "2024-03-15T23:59:59Z",
  "points_awarded": 50
}
```

**Response:**
```json
{
  "success": true,
  "message": "Workshop created successfully",
  "workshopId": 8
}
```

#### GET /api/events
Get all events with workshop counts.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Tech Conference 2024",
      "description": "Annual technology conference",
      "start_date": "2024-03-01T09:00:00Z",
      "end_date": "2024-03-01T17:00:00Z",
      "location": "Tech Hub Auditorium",
      "max_participants": 100,
      "created_at": "2024-01-01T00:00:00Z",
      "created_by_name": "Dr. Jane Smith",
      "workshop_count": 3
    }
  ]
}
```

---

### 4. Faculty Certificate Approval

#### PUT /api/faculty/approve/:id
Approve a certificate submission (Faculty/Admin only).

**Authentication:** Required (Faculty or Admin role)

**Response:**
```json
{
  "success": true,
  "message": "Certificate approved successfully"
}
```

#### PUT /api/faculty/reject/:id
Reject a certificate submission with feedback (Faculty/Admin only).

**Authentication:** Required (Faculty or Admin role)

**Request Body (Optional):**
```json
{
  "feedback": "Please resubmit with clearer documentation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Certificate rejected successfully"
}
```

#### GET /api/faculty/pending
Get all pending certificate submissions for review (Faculty/Admin only).

**Authentication:** Required (Faculty or Admin role)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Workshop Completion Certificate",
      "description": "Certificate for completing workshop",
      "submission_date": "2024-01-15T10:00:00Z",
      "file_path": "certificates/user1/workshop-cert.pdf",
      "student_name": "John Doe",
      "student_email": "john@example.com",
      "workshop_title": "Data Science Workshop",
      "points_awarded": 30,
      "event_title": "Tech Conference 2024"
    }
  ]
}
```

---

### 5. Admin Analytics

#### GET /api/admin/analytics
Get comprehensive system-wide analytics and reporting (Admin only).

**Authentication:** Required (Admin role)

**Response:**
```json
{
  "success": true,
  "data": {
    "systemHealth": {
      "pending_reviews": 15,
      "unread_notifications": 23,
      "active_workshops": 5,
      "total_users": 150,
      "total_certificates": 89,
      "total_points_awarded": 2340
    },
    "monthlyTrends": [
      {
        "month": "2024-01",
        "total_submissions": 25,
        "approved_submissions": 20,
        "rejected_submissions": 3,
        "pending_submissions": 2
      }
    ],
    "topStudents": [
      {
        "id": 5,
        "full_name": "Alice Johnson",
        "email": "alice@example.com",
        "total_points": 280,
        "certificates_count": 8,
        "avg_points_per_certificate": 35.0,
        "last_achievement_date": "2024-01-20T00:00:00Z"
      }
    ],
    "facultyWorkload": [
      {
        "id": 2,
        "full_name": "Dr. Jane Smith",
        "email": "jane@example.com",
        "events_created": 5,
        "workshops_created": 12,
        "certificates_reviewed": 45,
        "avg_review_time_days": 2.3
      }
    ],
    "workshopParticipation": [
      {
        "id": 1,
        "title": "Data Science Workshop",
        "points_awarded": 50,
        "event_title": "Tech Conference 2024",
        "total_submissions": 15,
        "approved_submissions": 12,
        "avg_points_awarded": 40.0
      }
    ],
    "userDistribution": [
      {
        "role": "student",
        "count": 120,
        "percentage": 80.0
      },
      {
        "role": "faculty",
        "count": 25,
        "percentage": 16.67
      },
      {
        "role": "admin",
        "count": 5,
        "percentage": 3.33
      }
    ],
    "recentActivity": [
      {
        "activity_type": "certificate_submission",
        "title": "Workshop Certificate",
        "user_name": "John Doe",
        "user_role": "student",
        "activity_date": "2024-01-20T10:00:00Z"
      }
    ]
  }
}
```

#### GET /api/analytics/user?userId=5
Get analytics for a specific user (Admin) or current user (all roles).

**Authentication:** Required

**Query Parameters:**
- `userId` (optional): Specific user ID (Admin only)

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 5,
      "email": "alice@example.com",
      "full_name": "Alice Johnson",
      "role": "student",
      "created_at": "2023-09-01T00:00:00Z"
    },
    "totalPoints": 280,
    "approvedCertificates": 8,
    "pendingCertificates": 1,
    "rejectedCertificates": 2,
    "activity": [
      {
        "title": "Workshop Certificate",
        "submission_date": "2024-01-15T10:00:00Z",
        "status": "approved",
        "review_date": "2024-01-16T09:00:00Z",
        "points_awarded": 50,
        "workshop_title": "Data Science Workshop",
        "event_title": "Tech Conference 2024"
      }
    ],
    "pointsHistory": [
      {
        "month": "2024-01",
        "points_earned": 150,
        "certificates_approved": 4
      }
    ]
  }
}
```

---

## Error Responses

All endpoints use consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "issues": [
    {
      "path": ["field_name"],
      "message": "Validation error message"
    }
  ]
}
```

## Common Status Codes

- **200**: Success
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (missing or invalid token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **500**: Internal Server Error

## Rate Limiting

All endpoints are subject to Cloudflare Workers rate limiting. Consider implementing exponential backoff for client requests.

## Testing

Use tools like Postman, curl, or HTTPie to test endpoints:

```bash
# Login
curl -X POST https://your-worker.your-subdomain.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.com","password":"password123"}'

# Get dashboard (with token)
curl -X GET https://your-worker.your-subdomain.workers.dev/api/student/dashboard \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```