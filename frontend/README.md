# SDMS Frontend (Next.js)

A comprehensive frontend application for the Student Database Management System built with Next.js, TypeScript, and Tailwind CSS.

## Features

### 🎓 Student Dashboard
- **Points Display**: Real-time points tracking with visual progress indicators
- **Upcoming Deadlines**: Calendar view of registration deadlines for events/workshops
- **Certificate Status**: Track submission status (pending, approved, rejected)
- **Notifications Panel**: Real-time updates on certificate reviews and point awards

### 👨‍🏫 Faculty Review Interface
- **Certificate Review**: Filterable list of all student certificate submissions
- **Approve/Reject Actions**: Streamlined approval workflow with reason tracking
- **Bulk Operations**: Mark multiple certificates for review
- **Student Search**: Filter by student name, email, or certificate title
- **Download Certificates**: Direct PDF download for review

### 🔧 Admin Panel
- **User Management**: Full CRUD operations for students, faculty, and admins
- **Point Rules Configuration**: Set point values for different activities
- **System Settings**: Configure file upload limits, notifications, auto-approval
- **Role-based Access**: Granular permissions for different user types

### 📁 File Upload Component
- **Drag & Drop**: Intuitive file upload with drag-and-drop support
- **Progress Tracking**: Real-time upload progress with error handling
- **Validation**: File type, size, and format validation
- **Metadata Collection**: Title, issue date, and description capture

### 🔔 Real-time Notifications
- **Live Updates**: Polling-based notification system (30-second intervals)
- **Toast Notifications**: Instant feedback for user actions
- **Notification Bell**: Header dropdown with unread count
- **Auto-mark Read**: Intelligent read status management

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Forms**: React Hook Form
- **Date Handling**: date-fns
- **Icons**: Lucide React
- **Notifications**: React Hot Toast

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── auth/login/        # Authentication pages
│   ├── dashboard/         # Student dashboard
│   ├── faculty/          # Faculty review interface  
│   └── admin/            # Admin panel
├── components/            # Reusable UI components
│   ├── dashboard/        # Role-specific dashboards
│   └── ui/              # Generic UI components
├── contexts/             # React Context providers
│   ├── AuthContext.tsx  # Authentication state
│   └── NotificationContext.tsx # Notification management
├── lib/                 # Utility libraries
│   └── api.ts          # API client and endpoints
├── types/              # TypeScript type definitions
└── styles/            # Global CSS and Tailwind config
```

## Component Architecture

### Modern React Patterns Used
- **Custom Hooks**: Encapsulated logic for auth and notifications
- **Context API**: Global state management for auth and notifications
- **Compound Components**: Flexible and reusable UI patterns
- **Error Boundaries**: Graceful error handling (recommended addition)
- **Suspense Ready**: Prepared for React 18 concurrent features

### Key Components

#### `StudentDashboard.tsx`
- Comprehensive overview with stats cards
- Recent certificates with status indicators
- Upcoming deadlines sidebar
- Real-time data fetching with loading states

#### `FacultyReviewInterface.tsx`
- Advanced filtering and search capabilities
- Bulk operations for efficiency
- Modal-based approval workflow
- Download integration for certificate viewing

#### `AdminPanel.tsx`
- Tabbed interface for different management areas
- Inline editing for user roles
- Point rules CRUD with validation
- System settings with type-safe form handling

#### `FileUpload.tsx`
- Progressive enhancement (works without JS)
- Comprehensive validation and error handling
- Metadata collection with form validation
- Visual progress feedback

#### `NotificationBell.tsx`
- Real-time updates with polling
- Unread count badge
- Dropdown panel with mark-as-read functionality
- Toast integration for new notifications

## Setup Instructions

### Prerequisites
```bash
Node.js 18+ and npm/yarn
```

### Installation
```bash
cd frontend
npm install
```

### Environment Configuration
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://127.0.0.1:8787
```

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production  
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

## API Integration

The frontend integrates with the Cloudflare Workers backend through a centralized API client (`lib/api.ts`) that handles:

- **Authentication**: JWT token management with automatic refresh
- **Error Handling**: Centralized error responses and user feedback
- **Request Interceptors**: Automatic token attachment
- **Response Interceptors**: Automatic logout on 401 errors
- **Type Safety**: Full TypeScript integration with backend schemas

### API Endpoints Used
- `POST /auth/login` - User authentication
- `POST /auth/register` - User registration  
- `GET /users` - User management (admin)
- `POST /certificates/upload` - File upload with metadata
- `GET /users/:id/certificates` - Certificate listings
- `PUT /certificates/:id/review` - Approval workflow
- Mock endpoints for notifications, points, events (ready for backend implementation)

## Responsive Design

The application is fully responsive with:
- **Mobile-first approach**: Tailwind's responsive utilities
- **Adaptive layouts**: Grid systems that work on all screen sizes
- **Touch-friendly**: Appropriate touch targets and gestures
- **Accessible**: WCAG 2.1 AA compliant color contrast and keyboard navigation

## Security Considerations

- **JWT Storage**: Secure token storage in localStorage with automatic cleanup
- **Role-based Routing**: Client-side route protection based on user roles
- **Input Validation**: Comprehensive form validation with React Hook Form
- **File Upload Security**: Client-side file type and size validation
- **XSS Prevention**: Proper input sanitization and React's built-in protections

## Performance Optimizations

- **Code Splitting**: Automatic route-based code splitting with Next.js
- **Image Optimization**: Next.js Image component for optimized loading
- **Bundle Analysis**: Built-in bundle analyzer for optimization insights
- **Caching Strategy**: Proper cache headers for static assets
- **Lazy Loading**: Components and data loaded on demand

## Accessibility Features

- **Keyboard Navigation**: Full keyboard support for all interactions
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Color Contrast**: WCAG AA compliant color schemes
- **Focus Management**: Visible focus indicators and logical tab order
- **Error Announcements**: Screen reader friendly error messages

## Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Progressive Enhancement**: Core functionality works without JavaScript
- **Polyfills**: Automatic polyfill injection for older browsers

## Deployment

### Vercel (Recommended)
```bash
npm run build
vercel --prod
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables
```bash
NEXT_PUBLIC_API_URL=https://your-worker.your-subdomain.workers.dev
```

## Development Notes

### Current Limitations
- **Package Dependencies**: TypeScript errors expected until `npm install` is run
- **Backend Integration**: Some features use mock data pending backend implementation
- **Real-time Updates**: Currently uses polling; WebSocket upgrade recommended for production

### Recommended Enhancements
- **Error Boundaries**: Add React error boundaries for graceful error handling
- **Testing**: Add Jest + React Testing Library for comprehensive test coverage
- **Storybook**: Component documentation and isolated development
- **PWA Features**: Service worker for offline capability
- **Performance Monitoring**: Sentry or similar for error tracking

### Code Quality
- **ESLint Configuration**: Comprehensive linting rules for code consistency
- **TypeScript Strict Mode**: Full type safety with strict compiler options
- **Prettier Integration**: Automatic code formatting
- **Husky Git Hooks**: Pre-commit quality checks

## Contributing

1. Follow the established TypeScript and React patterns
2. Ensure all components are properly typed
3. Add proper error handling and loading states
4. Include accessibility considerations
5. Write clear, self-documenting code
6. Update this README for significant changes

## License

MIT License - see LICENSE file for details