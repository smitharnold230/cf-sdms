# 📁 Project Structure

## Root Directory
```
cf-sdms/
├── 📄 README.md                    # Main project documentation
├── 📄 package.json                 # Backend dependencies
├── 📄 tsconfig.json                # TypeScript configuration
├── 📄 wrangler.toml                # Cloudflare Workers configuration
├── 📄 test-endpoints.cjs           # API testing script
├── 📄 .gitignore                   # Git ignore rules
├── 📄 final-sample-data.sql        # Sample data for testing
│
├── 📁 .github/                     # GitHub Actions workflows
│   └── workflows/
│       └── deploy.yml              # Automated deployment
│
├── 📁 docs/                        # Documentation
│   ├── 📄 DEPLOYMENT_CHECKLIST.md  # Deployment guide
│   ├── 📄 ENVIRONMENT_SETUP.md     # Environment setup
│   ├── 📄 SYSTEM_HEALTH_CHECK.md   # Health monitoring
│   └── guides/                     # Setup guides
│       ├── FRONTEND_DEPLOYMENT_*.md
│       └── GITHUB_*.md
│
├── 📁 frontend/                    # Next.js Frontend Application
│   ├── 📄 package.json             # Frontend dependencies
│   ├── 📄 next.config.js           # Next.js configuration
│   ├── 📄 tailwind.config.js       # Tailwind CSS config
│   ├── 📄 .env.production          # Production environment
│   └── src/                        # Source code
│       ├── app/                    # Next.js App Router pages
│       ├── components/             # React components
│       ├── contexts/               # React contexts
│       ├── hooks/                  # Custom hooks
│       ├── lib/                    # Utilities and API client
│       ├── styles/                 # CSS styles
│       └── types/                  # TypeScript types
│
├── 📁 src/                         # Backend Source Code
│   ├── 📄 index.ts                 # Main Worker entry point
│   ├── api/                        # API handlers
│   ├── db/                         # Database queries
│   ├── durableObjects/             # Real-time notifications
│   ├── middleware/                 # Authentication & rate limiting
│   ├── monitoring/                 # System monitoring
│   ├── routes/                     # API route handlers
│   ├── services/                   # Business logic services
│   └── utils/                      # Utility functions
│
├── 📁 migrations/                  # Database Migrations
│   ├── 001_init.sql               # Initial schema
│   ├── 002_expand_schema.sql      # Extended features
│   ├── 003_file_management.sql    # File system
│   └── 004_notification_system.sql # Notifications
│
├── 📁 scripts/                     # Deployment Scripts
│   ├── deploy.ps1                 # PowerShell deployment
│   └── deploy.sh                  # Bash deployment
│
└── 📁 tests/                       # Test Suite
    ├── 📄 package.json             # Test dependencies
    ├── 📄 vitest.config.ts         # Test configuration
    └── notification.test.ts        # Test files
```

## Key Components

### 🔧 **Backend (Cloudflare Workers)**
- **Runtime**: Cloudflare Workers with TypeScript
- **Database**: D1 SQLite with migrations
- **Storage**: R2 for file uploads, KV for caching
- **Real-time**: Durable Objects for notifications
- **Authentication**: JWT with role-based access

### 🎨 **Frontend (Next.js)**
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **State**: React Context + Custom Hooks
- **API**: Axios client with TypeScript
- **Deployment**: Cloudflare Pages

### 📊 **Database Schema**
- **Users**: Authentication and profiles
- **Events**: Workshops and conferences
- **Certificates**: Submissions and approvals
- **Notifications**: Real-time system alerts
- **Files**: Secure upload/download system
- **Analytics**: Usage tracking and reporting

### 🔐 **Security Features**
- JWT token authentication
- Role-based access control (Admin/Faculty/Student)
- Rate limiting with KV storage
- Secure file upload with virus scanning
- Input validation and sanitization

### 📈 **Monitoring & Analytics**
- System health endpoints
- User activity tracking
- Performance monitoring
- Error logging and reporting

## Environment Configuration

### Production
- **Backend**: `https://student-db-ms.smitharnold230.workers.dev`
- **Frontend**: `https://your-pages-domain.pages.dev`
- **Database**: Cloudflare D1 (Remote)
- **Storage**: Cloudflare R2 + KV

### Development
- **Backend**: `http://localhost:8787`
- **Frontend**: `http://localhost:3000`
- **Database**: Local D1 development database

## Getting Started

1. **Clone repository**
2. **Install dependencies**: `npm install`
3. **Set up environment**: Copy `.env.example` to `.env`
4. **Run migrations**: `wrangler d1 migrations apply student_db`
5. **Start development**: `npm run dev`

## Deployment

- **Automated**: Push to `main` branch triggers GitHub Actions
- **Manual**: Use `wrangler deploy` for backend, Cloudflare Pages for frontend
- **Monitoring**: Check `/api/status` for system health

---

*This structure ensures clean separation of concerns, easy maintenance, and professional development practices.*