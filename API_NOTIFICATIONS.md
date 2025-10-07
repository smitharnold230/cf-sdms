# Notification API Documentation

## Overview
The Notification API provides comprehensive notification management for the Student Development Management System, including real-time WebSocket notifications, user preferences, and deadline reminders.

## Base URL
```
https://your-worker-domain.workers.dev
```

## Authentication
All endpoints require JWT authentication via the `Authorization` header:
```
Authorization: Bearer <jwt-token>
```

## Endpoints

### User Notifications

#### Get User Notifications
```http
GET /api/notifications
```

Retrieves paginated notifications for the authenticated user.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (max: 50, default: 20)
- `unread` (optional): Filter unread notifications (true/false)
- `type` (optional): Filter by notification type (info, warning, success, error, deadline)

**Response:**
```json
{
  "success": true,
  "notifications": [
    {
      "id": 1,
      "title": "Certificate Approved",
      "message": "Your certificate submission has been approved.",
      "type": "success",
      "priority": "medium",
      "is_read": false,
      "created_at": "2025-10-05T10:30:00Z",
      "scheduled_for": null,
      "metadata": {
        "certificateId": 123,
        "points": 10
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

#### Get Unread Notification Count
```http
GET /api/notifications/unread-count
```

**Response:**
```json
{
  "success": true,
  "unreadCount": 3
}
```

#### Mark Notification as Read
```http
PATCH /api/notifications/{id}/read
```

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

#### Mark All Notifications as Read
```http
PATCH /api/notifications/read-all
```

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "updatedCount": 5
}
```

#### Delete Notification
```http
DELETE /api/notifications/{id}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted"
}
```

### Notification Management (Faculty/Admin)

#### Create Individual Notification
```http
POST /api/notifications
```

**Permissions:** Faculty, Admin

**Request Body:**
```json
{
  "userId": 123,
  "title": "Important Update",
  "message": "Your certificate requires additional documentation.",
  "type": "warning",
  "priority": "high",
  "scheduledFor": "2025-10-06T09:00:00Z",
  "metadata": {
    "certificateId": 456,
    "requiredDocs": ["transcript", "photo"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "notificationId": 789,
  "message": "Notification created successfully"
}
```

### User Preferences

#### Get Notification Preferences
```http
GET /api/notifications/preferences
```

**Response:**
```json
{
  "success": true,
  "preferences": {
    "emailNotifications": true,
    "pushNotifications": true,
    "deadlineReminders": true,
    "workshopUpdates": true,
    "systemAlerts": true,
    "reminderHours": [24, 72]
  }
}
```

#### Update Notification Preferences
```http
PUT /api/notifications/preferences
```

**Request Body:**
```json
{
  "emailNotifications": true,
  "pushNotifications": false,
  "deadlineReminders": true,
  "workshopUpdates": true,
  "systemAlerts": true,
  "reminderHours": [24, 48, 72]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification preferences updated",
  "preferences": {
    "emailNotifications": true,
    "pushNotifications": false,
    "deadlineReminders": true,
    "workshopUpdates": true,
    "systemAlerts": true,
    "reminderHours": [24, 48, 72]
  }
}
```

### Real-time WebSocket Connection

#### Connect to Notification WebSocket
```http
GET /api/notifications/ws
```

Establishes a WebSocket connection for real-time notifications.

**Headers:**
- `Authorization: Bearer <jwt-token>`
- `Upgrade: websocket`
- `Connection: Upgrade`

**WebSocket Messages:**

Incoming notification message:
```json
{
  "type": "notification",
  "data": {
    "id": 123,
    "title": "New Certificate Approved",
    "message": "Your leadership certificate has been approved.",
    "type": "success",
    "priority": "medium",
    "metadata": {
      "certificateId": 456,
      "points": 15
    }
  }
}
```

Connection status message:
```json
{
  "type": "status",
  "data": {
    "connected": true,
    "userId": 123,
    "connectionId": "conn_abc123"
  }
}
```

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Notification Types

| Type | Description | Example Use Case |
|------|-------------|------------------|
| `info` | General information | Workshop announcements |
| `warning` | Important alerts | Missing documentation |
| `success` | Positive confirmations | Certificate approved |
| `error` | System errors | Upload failed |
| `deadline` | Time-sensitive alerts | Submission due soon |

## Priority Levels

| Priority | Description | Behavior |
|----------|-------------|----------|
| `low` | Non-urgent | Standard delivery |
| `medium` | Normal priority | Standard delivery (default) |
| `high` | Important | Immediate delivery + email |
| `urgent` | Critical | Immediate delivery + email + SMS |

## Usage Examples

### JavaScript/TypeScript Client

```typescript
// Get notifications
async function getNotifications(page = 1, unreadOnly = false) {
  const params = new URLSearchParams({
    page: page.toString(),
    ...(unreadOnly && { unread: 'true' })
  });
  
  const response = await fetch(`/api/notifications?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.json();
}

// Mark notification as read
async function markAsRead(notificationId) {
  const response = await fetch(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.json();
}

// Update preferences
async function updatePreferences(preferences) {
  const response = await fetch('/api/notifications/preferences', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(preferences)
  });
  
  return response.json();
}

// WebSocket connection
function connectToNotifications(token) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/api/notifications/ws`);
  
  ws.onopen = () => {
    // Send authentication
    ws.send(JSON.stringify({
      type: 'auth',
      token: token
    }));
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    if (message.type === 'notification') {
      // Handle new notification
      showNotification(message.data);
    }
  };
  
  return ws;
}
```

### React Hook for Notifications

```typescript
import { useState, useEffect } from 'react';

export function useNotifications(token: string) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const websocket = connectToNotifications(token);
    
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'notification') {
        setNotifications(prev => [message.data, ...prev]);
        setUnreadCount(prev => prev + 1);
      }
    };

    setWs(websocket);

    // Fetch initial notifications
    fetchNotifications();
    fetchUnreadCount();

    return () => {
      websocket.close();
    };
  }, [token]);

  const fetchNotifications = async () => {
    const data = await getNotifications();
    setNotifications(data.notifications);
  };

  const fetchUnreadCount = async () => {
    const response = await fetch('/api/notifications/unread-count', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    setUnreadCount(data.unreadCount);
  };

  const markAsRead = async (id: number) => {
    await fetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    refresh: fetchNotifications
  };
}
```

## Rate Limiting

To prevent abuse, the notification API implements rate limiting:

- **User endpoints**: 100 requests per minute per user
- **Admin endpoints**: 200 requests per minute per user
- **WebSocket connections**: 5 connections per user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1633024800
```

## Security Considerations

1. **Authentication**: All endpoints require valid JWT tokens
2. **Authorization**: Role-based access control for management endpoints
3. **Data Privacy**: Users can only access their own notifications
4. **Input Validation**: All request data is validated and sanitized
5. **XSS Protection**: HTML content is escaped in notifications
6. **Rate Limiting**: Prevents abuse and DoS attacks

## Monitoring and Analytics

The notification system provides built-in monitoring:

- Delivery success/failure rates
- User engagement metrics
- WebSocket connection statistics
- Email/SMS delivery tracking
- Performance metrics

Access monitoring data via the Admin Analytics API:
```http
GET /api/admin/analytics/notifications
```