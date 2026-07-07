# Authentication module

This module covers the core authentication and account management flow for the Alternate Me backend.

## Implemented capabilities

- Registration with username, email, and password validation
- Email verification and resend flow
- Login, refresh, logout, and logout-all
- Password reset and password change with history protection
- Session tracking and revocation
- Basic RBAC via role and permission middleware
- Optional authentication middleware and ownership checks
- Google and GitHub OAuth entry points

## Key routes

- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/refresh
- POST /api/v1/auth/logout
- POST /api/v1/auth/logout-all
- POST /api/v1/auth/verify-email
- POST /api/v1/auth/resend-verification
- POST /api/v1/auth/forgot-password
- POST /api/v1/auth/reset-password
- GET /api/v1/auth/google
- GET /api/v1/auth/github
- GET /api/v1/me
- PUT /api/v1/me
- PATCH /api/v1/me/password
- PATCH /api/v1/me/preferences
- PATCH /api/v1/me/avatar
- DELETE /api/v1/account
- GET /api/v1/sessions
