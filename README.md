# Haven API — Backend Documentation

> **Nigerian service marketplace API** powering the Haven platform.  
> Connects customers with local service providers across Nigeria.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Quick Start](#quick-start)
4. [Environment Variables](#environment-variables)
5. [Database Setup (PostgreSQL)](#database-setup-postgresql)
6. [Running the Server](#running-the-server)
7. [Authentication Flow](#authentication-flow)
8. [API Reference](#api-reference)
   - [Auth](#auth-endpoints)
   - [Providers](#provider-endpoints)
   - [Customers](#customer-endpoints)
   - [Service Requests](#service-request-endpoints)
   - [Bookings & Payments](#booking--payment-endpoints)
   - [Reviews](#review-endpoints)
   - [Inquiries](#inquiry-endpoints)
   - [Points / Airtime](#points--airtime-endpoints)
   - [Housing](#housing-endpoints)
   - [Admin](#admin-endpoints)
9. [Request & Response Shapes](#request--response-shapes)
10. [Error Handling](#error-handling)
11. [File Uploads](#file-uploads)
12. [Payment Integration (Paystack)](#payment-integration-paystack)
13. [Connecting the Frontend](#connecting-the-frontend)
14. [Deploying to Production](#deploying-to-production)

---

## Tech Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express.js + TypeScript |
| Database | **PostgreSQL** |
| ORM | Prisma |
| Auth | JWT (access + refresh tokens) |
| Passwords | bcryptjs (cost 12) |
| File Storage | Cloudinary |
| Payments | Paystack |
| Airtime | VTPass |
| Email | Nodemailer (SMTP / Ethereal for dev) |
| Validation | Zod |
| Rate Limiting | express-rate-limit |

---

## Project Structure

```
haven-backend/
├── prisma/
│   └── schema.prisma          # Database schema (all 11 tables)
├── src/
│   ├── app.ts                 # Express app, middleware, routes
│   ├── server.ts              # HTTP server entry point
│   ├── config/
│   │   ├── index.ts           # All env vars with defaults
│   │   ├── database.ts        # Prisma client singleton
│   │   └── cloudinary.ts      # Cloudinary SDK setup
│   ├── middleware/
│   │   ├── auth.middleware.ts        # JWT verify, requireRole
│   │   ├── error.middleware.ts       # Global error + 404 handler
│   │   ├── validate.middleware.ts    # Zod request validation
│   │   ├── upload.middleware.ts      # Multer + Cloudinary helpers
│   │   └── rateLimiter.middleware.ts # Rate limiting
│   ├── modules/
│   │   ├── auth/              # Register, login, refresh, reset password
│   │   ├── customers/         # Customer profile, history, points
│   │   ├── providers/         # Provider directory, portfolio, inquiries, reviews
│   │   ├── service-requests/  # 4-step wizard backend
│   │   ├── bookings/          # Bookings + Paystack webhook
│   │   ├── reviews/           # Leave review, update provider rating
│   │   ├── inquiries/         # Customer → provider messaging
│   │   ├── points/            # Airtime redemption via VTPass
│   │   ├── housing/           # Housing listings CRUD
│   │   └── admin/             # Provider verification, user management
│   ├── types/
│   │   └── express.d.ts       # Express Request type extension
│   └── utils/
│       ├── jwt.ts             # Token generation & verification
│       ├── response.ts        # sendSuccess, sendError, paginateMeta
│       ├── helpers.ts         # Phone formatter, points calculator
│       └── email.ts           # Email sending + templates
├── .env.example               # Copy this to .env and fill in values
├── package.json
└── tsconfig.json
```

---

## Quick Start

### Prerequisites

- Node.js **18+**
- PostgreSQL **14+** running locally or on a cloud provider
- A Cloudinary account (free tier works for development)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd haven-backend
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` — at minimum you **must** set:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/haven_db
JWT_ACCESS_SECRET=any_long_random_string_at_least_32_chars
JWT_REFRESH_SECRET=different_long_random_string_at_least_32_chars
```

Everything else has safe defaults for development.

### 3. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations (creates all tables)
npm run db:migrate

# Seed with sample data (6 providers, 2 customers, housing listings)
npm run db:seed
```

### 4. Start the server

```bash
npm run dev
```

Server starts at `http://localhost:3001`

Health check: `GET http://localhost:3001/health`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `3001`) |
| `NODE_ENV` | No | `development` or `production` |
| `FRONTEND_URL` | No | Frontend origin for CORS (default: `http://localhost:3000`) |
| `DATABASE_URL` | **YES** | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | **YES** | Secret for signing access tokens (use 32+ chars) |
| `JWT_REFRESH_SECRET` | **YES** | Secret for signing refresh tokens (must differ from above) |
| `JWT_ACCESS_EXPIRY` | No | Access token TTL (default: `15m`) |
| `JWT_REFRESH_EXPIRY` | No | Refresh token TTL (default: `7d`) |
| `CLOUDINARY_CLOUD_NAME` | For uploads | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | For uploads | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | For uploads | Cloudinary API secret |
| `PAYSTACK_SECRET_KEY` | For payments | Paystack secret key (`sk_test_...` or `sk_live_...`) |
| `VTPASS_API_KEY` | For airtime | VTPass API key |
| `VTPASS_SECRET_KEY` | For airtime | VTPass secret key |
| `VTPASS_BASE_URL` | No | VTPass base URL (default: sandbox) |
| `RESEND_API_KEY` | For email | Resend API key (or configure SMTP below) |
| `SMTP_HOST` | For email | SMTP host (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | For email | SMTP port (default: `587`) |
| `SMTP_USER` | For email | SMTP username |
| `SMTP_PASS` | For email | SMTP password / app password |
| `EMAIL_FROM` | No | Sender email (default: `noreply@haven.ng`) |
| `POINTS_REDEMPTION_THRESHOLD` | No | Points needed to redeem (default: `5000`) |
| `POINTS_AIRTIME_VALUE` | No | Naira value of redemption (default: `1000`) |

> **Tip:** In development, if you skip Cloudinary/Paystack/VTPass keys, the server still runs — uploads will fail gracefully, payments use simulation mode, and emails log to console.

---

## Database Setup (PostgreSQL)

### Local PostgreSQL

```bash
# Using psql
psql -U postgres
CREATE DATABASE haven_db;
\q

# Then update .env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/haven_db
```

### Using Docker

```bash
docker run --name haven-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=haven_db \
  -p 5432:5432 \
  -d postgres:16
```

### Railway / Render / Supabase

Copy the connection string they give you directly into `DATABASE_URL`.

### Migrations

```bash
# Create and apply a new migration (development)
npm run db:migrate

# Apply existing migrations (production — no prompts)
npm run db:migrate:prod

# Open Prisma Studio (visual DB browser)
npm run db:studio
```

### Database Schema (summary)

| Table | Purpose |
|---|---|
| `User` | Base auth record for all user types |
| `Customer` | Customer profile (1:1 with User) |
| `Provider` | Business profile (1:1 with User) |
| `PortfolioImage` | Provider portfolio images |
| `HousingListing` | Hostel/lodge/apartment listings |
| `ServiceRequest` | Customer service requests (wizard step 1) |
| `ServiceRequestMedia` | Images/videos attached to requests |
| `Booking` | Confirmed provider booking |
| `Payment` | Paystack payment record |
| `Review` | Customer review of a booking |
| `Inquiry` | Customer message to a provider |
| `PointsTransaction` | Points earned/redeemed ledger |

---

## Running the Server

```bash
# Development (hot reload)
npm run dev

# Production build
npm run build
npm start
```

---

## Authentication Flow

Haven uses **JWT with access + refresh tokens**.

### Token Types

| Token | Expiry | Storage (Frontend) | Purpose |
|---|---|---|---|
| Access Token | 15 minutes | Memory / short-lived localStorage | Sent as `Bearer` header on every API request |
| Refresh Token | 7 days | httpOnly cookie (recommended) | Used to get a new access token |

### Flow

```
1. POST /api/v1/auth/login  →  { accessToken, refreshToken }
2. Store accessToken in memory (React state or short-lived)
3. Store refreshToken in httpOnly cookie
4. Every API request:  Authorization: Bearer <accessToken>
5. When access token expires (401):
   POST /api/v1/auth/refresh  →  { accessToken, refreshToken }
6. On logout: POST /api/v1/auth/logout  (invalidates refresh token in DB)
```

### Role System

| Role | Access |
|---|---|
| `CUSTOMER` | Dashboard, service requests, bookings, reviews, points |
| `PROVIDER` | Dashboard, portfolio management, inquiries, reviews |
| `ADMIN` | All above + provider verification, user management, stats |

---

## API Reference

**Base URL:** `http://localhost:3001/api/v1`

**All protected routes require:**
```
Authorization: Bearer <accessToken>
```

**Standard success response:**
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 12, "total": 48, "totalPages": 4 }
}
```

**Standard error response:**
```json
{
  "success": false,
  "message": "Human-readable error",
  "errors": [{ "field": "email", "message": "Invalid email" }]
}
```

---

## Auth Endpoints

### Register Customer

```
POST /api/v1/auth/register/customer
```

**Body:**
```json
{
  "fullName": "Chidi Okonkwo",
  "email": "chidi@example.com",
  "phone": "+2348012345678",
  "password": "securepassword123"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "chidi@example.com", "role": "CUSTOMER" },
    "customer": { "id": "uuid", "fullName": "Chidi Okonkwo", "phone": "+2348012345678", "totalPoints": 0 },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Errors:** `400` validation | `409` email exists

---

### Register Provider

```
POST /api/v1/auth/register/provider
Content-Type: multipart/form-data
```

**Form fields:**
| Field | Type | Required |
|---|---|---|
| `businessName` | text | Yes |
| `ownerName` | text | Yes |
| `email` | text | Yes |
| `phone` | text | Yes |
| `category` | text | Yes — see [Categories](#categories) |
| `location` | text | Yes |
| `description` | text | Yes (min 10 chars) |
| `services` | text | No |
| `experience` | text | No |
| `website` | text | No |
| `password` | text | Yes (min 6 chars) |
| `portfolioImages` | file(s) | No — max 6, 5MB each, JPG/PNG/WebP |

**Response 201:** Same structure as customer register, with `provider` instead of `customer`.

**Errors:** `400` validation | `409` email exists | `413` file too large

---

### Login

```
POST /api/v1/auth/login
```

Works for **both** customers and providers — role is determined from the database.

**Body:**
```json
{
  "email": "chidi@example.com",
  "password": "securepassword123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "chidi@example.com", "role": "CUSTOMER" },
    "profile": { "id": "uuid", "fullName": "Chidi Okonkwo", "totalPoints": 1200, ... },
    "role": "CUSTOMER",
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Errors:** `401` wrong credentials | `403` account suspended

---

### Refresh Token

```
POST /api/v1/auth/refresh
```

**Body:**
```json
{ "refreshToken": "eyJ..." }
```

**Response 200:**
```json
{
  "success": true,
  "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." }
}
```

---

### Logout

```
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>
```

**Response 200:**
```json
{ "success": true, "data": { "message": "Logged out successfully" } }
```

---

### Forgot Password

```
POST /api/v1/auth/forgot-password
```

**Body:** `{ "email": "user@example.com" }`

Always returns 200 (prevents email enumeration). Sends a reset link to the email if it exists.

---

### Reset Password

```
POST /api/v1/auth/reset-password
```

**Body:**
```json
{
  "token": "token_from_email_link",
  "newPassword": "newSecurePassword123"
}
```

**Errors:** `400` invalid/expired token (tokens expire in 1 hour)

---

## Provider Endpoints

### List Providers (Public)

```
GET /api/v1/providers
```

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `search` | string | Search business name, description, services |
| `category` | string | Filter by category (exact, case-insensitive) |
| `location` | string | Filter by location (partial match) |
| `minRating` | number | Minimum average rating (0–5) |
| `sort` | string | `rating` (default), `reviews`, `name`, `newest` |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 12, max: 50) |

**Example:**
```
GET /api/v1/providers?category=Home Cleaning Services&location=Lagos&minRating=4&sort=rating&page=1&limit=12
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "businessName": "CleanPro Services",
      "ownerName": "Ngozi Adeyemi",
      "phone": "+2348123456789",
      "category": "Home Cleaning Services",
      "location": "Lagos",
      "description": "...",
      "avgRating": "4.80",
      "totalReviews": 127,
      "isVerified": true,
      "portfolioImages": [{ "imageUrl": "https://res.cloudinary.com/..." }],
      "user": { "email": "cleanpro@example.com" }
    }
  ],
  "meta": { "page": 1, "limit": 12, "total": 3, "totalPages": 1 }
}
```

---

### Get Provider (Public)

```
GET /api/v1/providers/:id
```

Returns the full profile including all portfolio images, last 10 reviews, and stats. Also increments `profileViews`.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "businessName": "CleanPro Services",
    "portfolioImages": [ { "id": "uuid", "imageUrl": "...", "sortOrder": 0 } ],
    "reviews": [
      {
        "id": "uuid",
        "rating": 5,
        "comment": "Excellent service!",
        "createdAt": "2026-01-15T10:30:00Z",
        "customer": { "fullName": "Amara Eze", "avatarUrl": null }
      }
    ],
    "user": { "email": "cleanpro@example.com" }
  }
}
```

---

### Get My Profile (Provider)

```
GET /api/v1/providers/me
Authorization: Bearer <accessToken>   (PROVIDER role)
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "provider": { ... },
    "stats": {
      "profileViews": 342,
      "totalBookings": 89,
      "completedBookings": 76,
      "avgRating": "4.80",
      "totalReviews": 127
    }
  }
}
```

---

### Update My Profile (Provider)

```
PUT /api/v1/providers/me
Authorization: Bearer <accessToken>   (PROVIDER role)
```

**Body** (all fields optional):
```json
{
  "businessName": "CleanPro Services Ltd",
  "phone": "+2348123456789",
  "description": "Updated description...",
  "services": "Deep cleaning, Regular cleaning",
  "experience": "6+ years",
  "website": "https://cleanpro.ng"
}
```

---

### Upload Portfolio Images (Provider)

```
POST /api/v1/providers/me/portfolio
Authorization: Bearer <accessToken>   (PROVIDER role)
Content-Type: multipart/form-data
```

**Form field:** `images` — multiple files, max 6 per request, 5MB each, JPG/PNG/WebP

**Response 201:**
```json
{
  "success": true,
  "data": {
    "uploadedImages": [
      { "id": "uuid", "imageUrl": "https://res.cloudinary.com/...", "sortOrder": 0 }
    ]
  }
}
```

---

### Delete Portfolio Image (Provider)

```
DELETE /api/v1/providers/me/portfolio/:imageId
Authorization: Bearer <accessToken>   (PROVIDER role)
```

Also deletes from Cloudinary. **Response 200:** `{ "message": "Image deleted successfully" }`

---

### Get My Inquiries (Provider)

```
GET /api/v1/providers/me/inquiries?status=new&page=1&limit=20
Authorization: Bearer <accessToken>   (PROVIDER role)
```

**Status values:** `new`, `replied`, `closed`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "service": "Deep Cleaning",
      "message": "I need a full house clean before my event...",
      "reply": null,
      "status": "NEW",
      "createdAt": "2026-06-15T08:00:00Z",
      "customer": { "fullName": "Chidi Okonkwo", "phone": "+2348012345678" }
    }
  ]
}
```

---

### Reply to Inquiry (Provider)

```
PATCH /api/v1/providers/me/inquiries/:inquiryId
Authorization: Bearer <accessToken>   (PROVIDER role)
```

**Body:**
```json
{
  "reply": "Thank you! I'm available on Saturday. My rate is ₦8,000.",
  "status": "replied"
}
```

---

### Get My Reviews (Provider)

```
GET /api/v1/providers/me/reviews?page=1&limit=20
Authorization: Bearer <accessToken>   (PROVIDER role)
```

---

### Reply to Review (Provider)

```
POST /api/v1/providers/me/reviews/:reviewId/reply
Authorization: Bearer <accessToken>   (PROVIDER role)
```

**Body:** `{ "reply": "Thank you so much for the kind words!" }`

**Error:** `400` if already replied

---

## Customer Endpoints

All customer endpoints require `Authorization: Bearer <accessToken>` with `CUSTOMER` role.

### Get My Profile

```
GET /api/v1/customers/me
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fullName": "Chidi Okonkwo",
    "phone": "+2348012345678",
    "avatarUrl": null,
    "totalPoints": 1200,
    "address": null,
    "user": { "email": "chidi@example.com", "createdAt": "2026-01-01T00:00:00Z" }
  }
}
```

---

### Update My Profile

```
PUT /api/v1/customers/me
```

**Body** (all optional): `{ "fullName": "...", "phone": "...", "address": "..." }`

---

### Upload Avatar

```
POST /api/v1/customers/me/avatar
Content-Type: multipart/form-data
```

**Form field:** `avatar` — single image file, max 5MB

**Response 200:** `{ "avatarUrl": "https://res.cloudinary.com/...", "customer": { ... } }`

---

### Change Password

```
POST /api/v1/customers/me/change-password
```

**Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

**Errors:** `400` wrong current password

---

### Get Service History

```
GET /api/v1/customers/me/service-history?status=COMPLETED&page=1&limit=20
```

**Status filter values:** `PENDING_PAYMENT`, `PAID`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "amount": "8000.00",
      "status": "COMPLETED",
      "scheduledAt": "2026-05-20T10:00:00Z",
      "completedAt": "2026-05-20T14:00:00Z",
      "pointsAwarded": 160,
      "provider": { "businessName": "CleanPro Services", "category": "Home Cleaning Services", "phone": "+2348123456789" },
      "serviceRequest": { "category": "Home Cleaning Services", "description": "Full house clean", "address": "14 Eko Street, Lagos" },
      "review": { "rating": 5, "comment": "Excellent work!" },
      "payment": { "status": "SUCCESS", "amount": "8000.00" }
    }
  ]
}
```

---

### Get Points & Transaction History

```
GET /api/v1/customers/me/points
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "totalPoints": 1200,
    "transactions": [
      {
        "id": "uuid",
        "type": "EARNED",
        "amount": 160,
        "description": "Service completed – 160 points awarded",
        "createdAt": "2026-05-20T14:00:00Z"
      },
      {
        "id": "uuid",
        "type": "REDEEMED",
        "amount": 5000,
        "description": "Redeemed 5000 points for ₦1000 airtime to +2348012345678",
        "createdAt": "2026-04-10T09:00:00Z"
      }
    ]
  }
}
```

---

## Service Request Endpoints

All require `CUSTOMER` role.

### Create Service Request (Wizard Step 1)

```
POST /api/v1/service-requests
```

**Body:**
```json
{
  "category": "Home Cleaning Services",
  "description": "I need a full 4-bedroom house cleaned before a family event.",
  "address": "14 Eko Street, Lagos Island",
  "preferredDate": "2026-07-05",
  "preferredTime": "09:00",
  "urgency": "STANDARD"
}
```

**Urgency values:** `STANDARD` | `URGENT` | `EMERGENCY`

**Response 201:**
```json
{
  "success": true,
  "data": {
    "serviceRequest": {
      "id": "uuid",
      "status": "PENDING",
      "urgency": "STANDARD",
      ...
    }
  }
}
```

---

### Upload Request Media (Wizard Step 2)

```
POST /api/v1/service-requests/:id/media
Content-Type: multipart/form-data
```

**Form field:** `files` — images (JPG/PNG/WebP, 5MB) or videos (MP4/MOV, 20MB), max 8 files

**Response 201:**
```json
{
  "success": true,
  "data": {
    "mediaFiles": [
      { "id": "uuid", "mediaUrl": "https://res.cloudinary.com/...", "mediaType": "image" }
    ]
  }
}
```

---

### Get Provider Quotes (Wizard Step 3)

```
GET /api/v1/service-requests/:id/quotes
```

Returns up to 5 matching providers based on the request category, sorted by rating.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "quotes": [
      {
        "providerId": "uuid",
        "businessName": "CleanPro Services",
        "category": "Home Cleaning Services",
        "location": "Lagos",
        "avgRating": "4.80",
        "totalReviews": 127,
        "phone": "+2348123456789",
        "portfolioImage": "https://res.cloudinary.com/...",
        "estimatedPrice": 5000,
        "estimatedDuration": "2-4 hours",
        "availableDate": "2026-07-05T00:00:00Z"
      }
    ]
  }
}
```

---

### Get My Service Requests

```
GET /api/v1/service-requests
```

Returns all service requests with associated media and bookings.

---

## Booking & Payment Endpoints

### Create Booking (Wizard Step 4)

```
POST /api/v1/bookings
Authorization: Bearer <accessToken>   (CUSTOMER role)
```

**Body:**
```json
{
  "serviceRequestId": "uuid-of-service-request",
  "providerId": "uuid-of-chosen-provider",
  "scheduledAt": "2026-07-05T09:00:00.000Z",
  "amount": 8000
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "uuid",
      "status": "PENDING_PAYMENT",
      "amount": "8000.00",
      "scheduledAt": "2026-07-05T09:00:00Z"
    },
    "paystackAuthorizationUrl": "https://checkout.paystack.com/...",
    "paystackReference": "HAVEN-uuid"
  }
}
```

> **Frontend:** Redirect the user to `paystackAuthorizationUrl` to complete payment. After payment, Paystack redirects back to your `FRONTEND_URL/booking/confirm?bookingId=uuid`.

---

### Paystack Webhook

```
POST /api/v1/bookings/paystack/callback
```

This endpoint is called **by Paystack**, not by your frontend. Configure the webhook URL in your [Paystack Dashboard](https://dashboard.paystack.com/#/settings/developer) → Webhooks.

Set webhook URL to: `https://your-api-domain.com/api/v1/bookings/paystack/callback`

On `charge.success` event, the backend:
1. Verifies the Paystack signature
2. Updates booking status to `PAID`
3. Creates a Payment record
4. Sends a booking confirmation email to the customer

---

### Get Booking Details

```
GET /api/v1/bookings/:id
Authorization: Bearer <accessToken>
```

---

### Mark Booking Complete (Provider)

```
POST /api/v1/bookings/:id/complete
Authorization: Bearer <accessToken>   (PROVIDER role)
```

On completion:
- Booking status → `COMPLETED`
- Customer points awarded (`amount ÷ 50` points, e.g. ₦8000 → 160 points)
- Points transaction logged
- Service request status → `COMPLETED`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "booking": { "status": "COMPLETED", "completedAt": "..." },
    "pointsAwarded": 160
  }
}
```

---

## Review Endpoints

### Leave a Review (Customer)

```
POST /api/v1/bookings/:bookingId/reviews
Authorization: Bearer <accessToken>   (CUSTOMER role)
```

Only allowed on `COMPLETED` bookings. One review per booking.

**Body:**
```json
{
  "rating": 5,
  "comment": "Ngozi and her team did an amazing job! The house was spotless."
}
```

After creating a review:
- Provider's `avgRating` and `totalReviews` are recalculated automatically
- Provider receives a notification email

**Errors:** `400` booking not completed | `409` already reviewed

---

## Inquiry Endpoints

### Send Inquiry to Provider (Customer)

```
POST /api/v1/inquiries
Authorization: Bearer <accessToken>   (CUSTOMER role)
```

**Body:**
```json
{
  "providerId": "uuid-of-provider",
  "service": "Deep Cleaning",
  "message": "Hi, I need a 5-bedroom house cleaned this weekend. Do you have availability?"
}
```

The provider receives an email notification.

**Response 201:** `{ "inquiry": { ... } }`

> **Note:** Providers manage their inquiry inbox via `GET /api/v1/providers/me/inquiries` and respond via `PATCH /api/v1/providers/me/inquiries/:id`.

---

## Points / Airtime Endpoints

### Redeem Points for Airtime (Customer)

```
POST /api/v1/points/redeem
Authorization: Bearer <accessToken>   (CUSTOMER role)
```

**Requirement:** Customer must have at least `5000` points (configurable via `POINTS_REDEMPTION_THRESHOLD`).

**Body:**
```json
{
  "phone": "+2348012345678"
}
```

The backend:
1. Checks customer has ≥ 5000 points
2. Calls VTPass API to send ₦1000 airtime to the phone number
3. Deducts 5000 points from customer's balance
4. Logs a `REDEEMED` points transaction

**Response 200:**
```json
{
  "success": true,
  "data": {
    "remainingPoints": 200,
    "redemptionRef": "HAVEN-AIRTIME-1717603200000"
  }
}
```

**Errors:** `400` not enough points | `402` airtime API error

> **Dev mode:** If `VTPASS_API_KEY` is not set, the redemption is simulated and logged to console.

---

## Housing Endpoints

### List Housing (Public)

```
GET /api/v1/housing
```

**Query parameters:**

| Param | Description |
|---|---|
| `search` | Search title, description, location |
| `category` | `HOSTEL`, `LODGE`, `APARTMENT`, `SQUAT` |
| `location` | Partial match on location |
| `minRating` | Minimum average rating |
| `sort` | `price_asc`, `price_desc`, `rating`, `newest` (default) |
| `page` / `limit` | Pagination |

---

### Create Housing Listing

```
POST /api/v1/housing
Authorization: Bearer <accessToken>   (any logged-in user)
```

**Body:**
```json
{
  "title": "Clean Hostel Room – UNILAG Area",
  "category": "HOSTEL",
  "description": "Well-maintained room close to UNILAG main gate...",
  "location": "Yaba, Lagos",
  "address": "12 Herbert Macaulay Way, Yaba",
  "pricePerMonth": 18000,
  "phone": "+2348012345678",
  "imageUrl": "https://res.cloudinary.com/..."
}
```

**Category values:** `HOSTEL` | `LODGE` | `APARTMENT` | `SQUAT`

---

### Get Single Housing Listing

```
GET /api/v1/housing/:id
```

---

## Admin Endpoints

All admin endpoints require `ADMIN` role. Create an admin by manually setting `role = 'ADMIN'` in the database, or use Prisma Studio (`npm run db:studio`).

### List Providers

```
GET /api/v1/admin/providers?isVerified=false&page=1&limit=20
```

### Verify / Publish Provider

```
PATCH /api/v1/admin/providers/:id/verify
```

**Body:** `{ "isVerified": true, "isPublished": true }`

### List Users

```
GET /api/v1/admin/users?page=1&limit=20
```

### Suspend / Reactivate User

```
PATCH /api/v1/admin/users/:id/status
```

**Body:** `{ "isActive": false }`

### Platform Stats

```
GET /api/v1/admin/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "customers": 1420,
    "providers": 88,
    "bookings": 3204,
    "completedBookings": 2891,
    "totalRevenue": "14455000.00"
  }
}
```

---

## Request & Response Shapes

### Pagination (all list endpoints)

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 12,
    "total": 48,
    "totalPages": 4
  }
}
```

### Categories

The following category strings are used across the platform:

**Service Categories:**
- `Academic Support`
- `Digital Services`
- `Home Services`
- `Cooking Services`
- `Laundry Services`
- `Home Cleaning Services`
- `Hair Styling Services`
- `Farming Services`

**Housing Categories:**
- `HOSTEL`
- `LODGE`
- `APARTMENT`
- `SQUAT`

---

## Error Handling

| HTTP Status | Meaning |
|---|---|
| `400` | Bad request / validation error |
| `401` | Not authenticated (missing or invalid token) |
| `402` | Payment/airtime processing error |
| `403` | Authenticated but not authorized (wrong role or not owner) |
| `404` | Resource not found |
| `409` | Conflict (duplicate email, already reviewed, already booked) |
| `413` | File too large |
| `415` | Unsupported media type |
| `429` | Too many requests (rate limited) |
| `500` | Internal server error |

**Validation error example:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    { "field": "email", "message": "Invalid email address" },
    { "field": "password", "message": "Password must be at least 6 characters" }
  ]
}
```

---

## File Uploads

### Supported file types

| Context | Types | Max size |
|---|---|---|
| Portfolio images | JPG, PNG, WebP | 5MB each |
| Avatar | JPG, PNG, WebP | 5MB |
| Service request images | JPG, PNG, WebP | 5MB each |
| Service request videos | MP4, MOV, AVI | 20MB each |

### How to upload (multipart/form-data)

**JavaScript (fetch):**
```javascript
const formData = new FormData();
formData.append('images', file1);
formData.append('images', file2);

const res = await fetch('/api/v1/providers/me/portfolio', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}` },
  body: formData
  // Do NOT set Content-Type header — browser sets it with boundary
});
```

**Axios:**
```javascript
const formData = new FormData();
formData.append('avatar', file);

await axios.post('/api/v1/customers/me/avatar', formData, {
  headers: { 'Authorization': `Bearer ${token}` }
  // Axios sets Content-Type automatically for FormData
});
```

---

## Payment Integration (Paystack)

### Setup

1. Create a Paystack account at [paystack.com](https://paystack.com)
2. Get your test keys from Dashboard → Settings → API Keys
3. Add to `.env`:
   ```
   PAYSTACK_SECRET_KEY=sk_test_...
   PAYSTACK_PUBLIC_KEY=pk_test_...
   ```

### Payment Flow

```
Customer selects provider →
POST /api/v1/bookings  →  { paystackAuthorizationUrl }
  ↓
Frontend redirects to Paystack checkout URL
  ↓
Customer pays on Paystack
  ↓
Paystack calls POST /api/v1/bookings/paystack/callback (webhook)
  ↓
API verifies signature, updates booking to PAID
  ↓
Paystack redirects customer to FRONTEND_URL/booking/confirm?bookingId=uuid
  ↓
Frontend fetches GET /api/v1/bookings/:id to show confirmation
```

### Webhook Setup

In [Paystack Dashboard](https://dashboard.paystack.com/#/settings/developer):
- Webhook URL: `https://your-api.com/api/v1/bookings/paystack/callback`

> **Important:** The webhook endpoint must be publicly accessible (use ngrok for local dev).

### Local webhook testing with ngrok

```bash
ngrok http 3001
# Copy the HTTPS URL, e.g. https://abc123.ngrok.io
# Set in Paystack dashboard: https://abc123.ngrok.io/api/v1/bookings/paystack/callback
```

---

## Connecting the Frontend

### Replace localStorage auth with real API

**1. Create an API client (`lib/api.ts` in your Next.js project):**

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

let accessToken: string | null = null;

export const setAccessToken = (token: string) => { accessToken = token; };
export const clearAccessToken = () => { accessToken = null; };

const apiFetch = async (path: string, options: RequestInit = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Try to refresh token
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') }),
    });
    if (refreshRes.ok) {
      const { data } = await refreshRes.json();
      setAccessToken(data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      // Retry original request
      return apiFetch(path, options);
    } else {
      clearAccessToken();
      window.location.href = '/auth/login';
    }
  }

  return res.json();
};

export default apiFetch;
```

**2. Update `hooks/use-auth.ts`:**

```typescript
import apiFetch, { setAccessToken, clearAccessToken } from '@/lib/api';

export const login = async (email: string, password: string) => {
  const result = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (result.success) {
    setAccessToken(result.data.accessToken);
    localStorage.setItem('refreshToken', result.data.refreshToken);
    // Store user info in React state / context
  }
  return result;
};

export const logout = async () => {
  await apiFetch('/auth/logout', { method: 'POST' });
  clearAccessToken();
  localStorage.removeItem('refreshToken');
};
```

**3. Replace hardcoded data in pages:**

| Old (localStorage / hardcoded) | New (API call) |
|---|---|
| `dummyProviders` in providers-section.tsx | `GET /api/v1/providers?limit=3` |
| `dummyProviders` in providers/page.tsx | `GET /api/v1/providers?<filters>` |
| Provider object in provider/[id]/page.tsx | `GET /api/v1/providers/:id` |
| `sampleServiceHistory` in customer dashboard | `GET /api/v1/customers/me/service-history` |
| `localStorage.getItem('currentCustomer')` | `GET /api/v1/customers/me` |
| `localStorage.getItem('currentUser')` | `GET /api/v1/providers/me` |
| `recentInquiries` in inquiries-tab.tsx | `GET /api/v1/providers/me/inquiries` |
| `recentReviews` in reviews-tab.tsx | `GET /api/v1/providers/me/reviews` |
| Mock payment in request-service/page.tsx | `POST /api/v1/bookings` → Paystack redirect |
| `alert()` in points-redemption-modal.tsx | `POST /api/v1/points/redeem` |

**4. Add to `.env.local` in your Next.js project:**

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

---

## Deploying to Production

### Railway.app (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

# Create project
railway init
railway add postgresql  # Adds PostgreSQL + sets DATABASE_URL automatically

# Deploy
railway up

# Set environment variables in Railway dashboard
# Run migrations
railway run npm run db:migrate:prod
railway run npm run db:seed
```

### Render.com

1. Create a new **Web Service** pointing to your repo
2. Build command: `npm install && npm run build && npm run db:generate`
3. Start command: `npm run db:migrate:prod && npm start`
4. Add a **PostgreSQL** database and copy the connection string to `DATABASE_URL`
5. Add all other environment variables in the dashboard

### Environment checklist for production

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` — production PostgreSQL URL
- [ ] `JWT_ACCESS_SECRET` — strong random string (32+ chars), different from dev
- [ ] `JWT_REFRESH_SECRET` — different strong random string
- [ ] `FRONTEND_URL` — your live frontend URL (for CORS)
- [ ] `CLOUDINARY_*` — production Cloudinary credentials
- [ ] `PAYSTACK_SECRET_KEY` — live key (`sk_live_...`)
- [ ] `VTPASS_BASE_URL=https://vtpass.com/api` — switch from sandbox
- [ ] Email configured (Resend or SMTP)

---

## Seed Test Accounts

After running `npm run db:seed`, these accounts are available (all passwords: `password123`):

| Role | Email |
|---|---|
| Admin | admin@haven.ng |
| Customer | chidi@example.com |
| Customer | amara@example.com |
| Provider | cleanpro@example.com |
| Provider | techfix@example.com |
| Provider | laundryking@example.com |
| Provider | acadhelp@example.com |
| Provider | hairqueen@example.com |
| Provider | homechef@example.com |

---

## Health Check

```
GET /health
```

```json
{
  "status": "ok",
  "service": "haven-api",
  "timestamp": "2026-06-21T10:00:00.000Z"
}
```

---

*Built for the Nigerian market. WhatsApp-first, Paystack payments, VTPass airtime, Naira throughout.*
