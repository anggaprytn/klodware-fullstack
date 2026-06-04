# PRD: Klodware

## Docs

Based on:

- Superintendent Monthly Inspection Checklist PDF

  [5.7 Superintendent Monthly Inspection Checklist v1.2.pdf 3441666](attachments/ec275675-30cb-419d-853d-af67979f214e.pdf)

- Existing Ship Maintenance Mobile Flow Reference

  [Ship_Maintenance Userguide.pdf 2643849](attachments/a37570d3-1185-4c5b-a3b7-e219705dba37.pdf)

---

# PRD Patch v4.1: Username/Password Login

## 1. Auth Decision Update

Klodware Ship Maintenance MVP will use username/password login.

Mobile users must login before accessing vessel list, checklist templates, inspections, photo upload, submit, reports, and settings.

Mobile still communicates only with the Next.js REST JSON API.

React Native must not call PocketBase directly.

```text
React Native Mobile
-> Next.js REST API
-> PocketBase
```

PocketBase is still used as the backend datastore and auth/user source.

Next.js remains the mobile-facing API facade.

---

## 2. Updated Architecture

```text
React Native Mobile
-> Next.js REST API with Bearer token
-> PocketBase Auth + Collections
-> PocketBase Files
-> PDF Worker / Playwright
-> Web Admin Dashboard
```

---

## 3. Auth Scope

### Build This

- username/password login for mobile
- username/password login for web admin
- secure token storage on mobile
- authenticated REST JSON API
- logout
- profile endpoint
- user status check
- role field for admin/web access
- backend derives inspector from authenticated user

### Do Not Build in MVP

- SSO
- OAuth
- password reset email
- forgot password flow
- multi-factor authentication
- complex RBAC
- organization hierarchy
- approval workflow

---

## 4. User Model

Use PocketBase auth collection for users.

Recommended collection name:

```text
users
```

Required fields:

| Field         | Type     | Required | Notes                          |
| ------------- | -------- | -------: | ------------------------------ |
| username      | text     |      Yes | Used for login                 |
| email         | email    | Optional | Can be used later              |
| password      | password |      Yes | Managed by auth collection     |
| full_name     | text     |      Yes | Inspector/admin display name   |
| employee_no   | text     | Optional | Internal employee ID           |
| role          | select   |      Yes | `admin`, `inspector`, `viewer` |
| status        | select   |      Yes | `active`, `inactive`           |
| metadata_json | json     | Optional | Extra user metadata            |

Role behavior:

| Role      |        Mobile |            Web Admin |
| --------- | ------------: | -------------------: |
| inspector |           Yes |                   No |
| admin     |           Yes |                  Yes |
| viewer    | No by default | Yes, read-only later |

MVP can keep role handling simple:

- mobile allows `inspector` and `admin`
- web admin allows `admin`
- inactive users cannot login or sync

---

## 5. Mobile Auth Flow

### First Launch

```text
Splash
-> Check secure stored session
-> If valid session exists, go to Main Tabs
-> If no session, go to Login
```

### Login Flow

```text
User enters username/password
-> POST /api/mobile/auth/login
-> Backend validates credentials
-> Backend returns access token and user profile
-> Mobile stores token securely
-> Mobile opens Home
```

### Offline Behavior

If user has logged in before:

- app may open offline using cached session and cached profile
- local drafts remain accessible offline
- sync waits until internet is available
- if token is invalid when online, sync pauses and asks user to login again

If user has never logged in:

- app cannot be used offline
- show login-required screen

### Logout

Logout should:

- clear access token
- keep local drafts unless user chooses clear data
- stop sync queue
- redirect to Login

---

## 6. Updated Mobile Navigation

```text
Root
├── Splash / Session Check
├── Login
└── Main Tabs
    ├── Home
    │   ├── Vessel List
    │   ├── Vessel Detail
    │   └── Start Inspection
    ├── Inspections
    │   ├── Inspection List
    │   ├── Inspection Dashboard
    │   ├── Category Item List
    │   ├── Checklist Item Detail
    │   ├── Photo Capture
    │   ├── Running Hours
    │   ├── Other Comments
    │   ├── Review & Validation
    │   └── Submit & Sync Queue
    ├── Reports
    │   ├── Reports List
    │   └── PDF Preview
    └── Settings
        ├── Profile
        ├── Sync Diagnostics
        ├── Debug Export
        └── Logout
```

Bottom tabs remain static:

```text
Home
Inspections
Reports
Settings
```

---

## 7. Login Screen

Components:

- Klodware logo
- username input
- password input
- show/hide password
- login button
- offline status indicator
- app version text
- error message area

Validation:

- username required
- password required
- disable login button while submitting
- show friendly error for invalid credentials
- show connection error if backend unreachable

Example error copy:

```text
Username atau password salah.
```

```text
Tidak bisa terhubung ke server. Coba lagi nanti.
```

---

## 8. Secure Mobile Storage

Mobile must store:

| Data              | Storage                              |
| ----------------- | ------------------------------------ |
| access token      | Secure storage / Keychain / Keystore |
| user profile      | local DB or secure storage           |
| device_id         | local settings                       |
| active template   | local DB                             |
| inspection drafts | local DB                             |
| photos            | local file directory                 |

Mobile must not store:

- raw password
- PocketBase superuser credential
- admin credential
- PocketBase superuser token

---

## 9. Auth API Contract

Base path:

```text
/api/mobile/auth
```

### 9.1 Login

```http
POST /api/mobile/auth/login
Content-Type: application/json
```

Request:

```json
{
  "username": "john.doe",
  "password": "secret-password",
  "device_id": "android-device-uuid",
  "app_version": "1.0.0"
}
```

Response:

```json
{
  "success": true,
  "server_time": "2026-06-04T06:30:00.000Z",
  "data": {
    "access_token": "opaque-access-token",
    "token_type": "Bearer",
    "expires_at": "2026-06-05T06:30:00.000Z",
    "user": {
      "id": "user-001",
      "username": "john.doe",
      "full_name": "John Doe",
      "employee_no": "EMP001",
      "role": "inspector",
      "status": "active"
    }
  }
}
```

Error:

```json
{
  "success": false,
  "server_time": "2026-06-04T06:30:00.000Z",
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Username or password is incorrect",
    "retryable": false
  }
}
```

---

### 9.2 Get Current User

```http
GET /api/mobile/auth/me
Authorization: Bearer <access_token>
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-001",
      "username": "john.doe",
      "full_name": "John Doe",
      "employee_no": "EMP001",
      "role": "inspector",
      "status": "active"
    }
  }
}
```

---

### 9.3 Logout

```http
POST /api/mobile/auth/logout
Authorization: Bearer <access_token>
```

Response:

```json
{
  "success": true,
  "data": {
    "logged_out": true
  }
}
```

MVP logout can be client-side token clearing if server-side revocation is not implemented yet.

---

## 10. Updated Common Mobile Headers

All protected mobile endpoints require:

```http
Authorization: Bearer <access_token>
X-Device-Id: android-device-uuid
X-App-Version: 1.0.0
X-Request-Id: uuid
```

Remove from previous PRD:

```http
X-Install-Key
X-Inspection-Token
```

Reason:

Authentication now comes from username/password token.

Device ID remains only for traceability and idempotency.

---

## 11. Updated Protected Mobile Endpoints

These endpoints require `Authorization: Bearer <access_token>`:

```text
GET  /api/mobile/bootstrap
GET  /api/mobile/vessels
GET  /api/mobile/checklist-templates/:id
POST /api/mobile/inspections/upsert
POST /api/mobile/inspections/:id/photos
POST /api/mobile/inspections/:id/submit
GET  /api/mobile/inspections
GET  /api/mobile/inspections/:id
GET  /api/mobile/inspections/:id/pdf
GET  /api/mobile/inspections/:id/pdf/download
POST /api/mobile/inspections/:id/pdf/regenerate
```

Public endpoints:

```text
GET  /api/mobile/health
POST /api/mobile/auth/login
```

---

## 12. Updated Inspection Upsert Contract

Backend must derive inspector from authenticated user.

Mobile should not be trusted as source of inspector identity.

### Request

```http
POST /api/mobile/inspections/upsert
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "local_id": "local-insp-uuid",
  "device_id": "android-device-uuid",
  "template_id": "superintendent-monthly-v1",
  "template_version": 1,
  "template_checksum": "sha256-template-checksum",
  "vessel_id": "vessel-001",
  "place": "Jakarta Anchorage",
  "started_at": "2026-06-04T02:00:00.000Z",
  "updated_at": "2026-06-04T04:00:00.000Z",
  "status": "draft",
  "items": [
    {
      "item_template_id": "10-draft-mark",
      "section_code": "10",
      "score": "3",
      "remarks": "Draft mark faded, needs repainting",
      "is_resolved": false,
      "photo_refs": [
        {
          "local_photo_id": "photo-local-001",
          "server_photo_id": "photo-server-001",
          "type": "before"
        }
      ],
      "updated_at": "2026-06-04T03:00:00.000Z"
    }
  ],
  "running_hours": [
    {
      "equipment": "Main Engine No. 1",
      "value": 1200
    }
  ],
  "other_comments": "General vessel condition acceptable with minor findings."
}
```

### Response

```json
{
  "success": true,
  "data": {
    "inspection_id": "insp-server-001",
    "local_id": "local-insp-uuid",
    "status": "draft",
    "pdf_status": "not_requested",
    "synced_at": "2026-06-04T06:30:00.000Z"
  }
}
```

Backend sets:

```json
{
  "inspector_user_id": "user-001",
  "inspector_name": "John Doe",
  "inspector_employee_no": "EMP001"
}
```

from authenticated token.

---

## 13. Updated Photo Upload Contract

```http
POST /api/mobile/inspections/{inspection_id}/photos
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

Fields:

| Field            | Type         | Required |
| ---------------- | ------------ | -------: |
| file             | image/jpeg   |      Yes |
| local_photo_id   | string       |      Yes |
| device_id        | string       |      Yes |
| item_template_id | string       |      Yes |
| section_code     | string       | Optional |
| photo_type       | before/after |      Yes |
| captured_at      | ISO datetime |      Yes |
| latitude         | number       | Optional |
| longitude        | number       | Optional |
| vessel_id        | string       |      Yes |
| checksum         | string       |      Yes |
| metadata_json    | json string  | Optional |

Backend derives inspector from authenticated user.

---

## 14. Updated Submit Contract

```http
POST /api/mobile/inspections/{inspection_id}/submit
Authorization: Bearer <access_token>
Content-Type: application/json
```

Request:

```json
{
  "device_id": "android-device-uuid",
  "submitted_at": "2026-06-04T06:35:00.000Z"
}
```

Backend validates:

- authenticated user owns the inspection, unless role is admin
- inspection is not locked
- template exists
- template checksum matches
- vessel exists
- required scores exist
- required remarks exist
- required photos exist
- resolved findings have after photo

Response:

```json
{
  "success": true,
  "data": {
    "inspection_id": "insp-server-001",
    "status": "submitted",
    "locked": true,
    "pdf_status": "queued",
    "pdf_report_id": "pdf-report-001"
  }
}
```

---

## 15. Updated Idempotency Rule

Old:

```text
device_id + local_id
```

New:

```text
user_id + device_id + local_id
```

Computed key:

```text
idempotency_key = sha256(user_id + ":" + device_id + ":" + local_id)
```

Photo idempotency:

```text
photo_idempotency_key = sha256(inspection_id + ":" + local_photo_id)
```

Reason:

Two users may accidentally produce the same local ID on different devices.

Authenticated user ID makes the key safer.

---

## 16. Updated PocketBase Collections

### users

Auth collection.

Fields:

| Field         | Type     |
| ------------- | -------- |
| username      | text     |
| email         | email    |
| password      | password |
| full_name     | text     |
| employee_no   | text     |
| role          | select   |
| status        | select   |
| metadata_json | json     |

Role values:

```text
admin
inspector
viewer
```

Status values:

```text
active
inactive
```

---

### inspections

Update fields:

| Field                 | Type                |
| --------------------- | ------------------- |
| local_id              | text                |
| user                  | relation to users   |
| device_id             | text                |
| idempotency_key       | text                |
| vessel                | relation to vessels |
| template_id           | text                |
| template_version      | number              |
| template_checksum     | text                |
| inspector_name        | text                |
| inspector_employee_no | text                |
| place                 | text                |
| status                | select              |
| pdf_status            | select              |
| started_at            | date                |
| submitted_at          | date                |
| synced_at             | date                |
| locked_at             | date                |
| summary_json          | json                |
| raw_payload_json      | json                |

Remove:

```text
install_key_hash
inspection_token_hash
```

---

### inspection_photos

Keep:

| Field                 | Type                    |
| --------------------- | ----------------------- |
| inspection            | relation to inspections |
| local_photo_id        | text                    |
| photo_idempotency_key | text                    |
| item_template_id      | text                    |
| section_code          | text                    |
| photo_type            | before/after            |
| file                  | file                    |
| captured_at           | date                    |
| uploaded_at           | date                    |
| latitude              | number                  |
| longitude             | number                  |
| checksum              | text                    |
| metadata_json         | json                    |

---

## 17. Updated Web Admin Auth

Web admin also uses username/password.

Allowed roles:

```text
admin
```

Admin pages require authenticated admin session.

Admin routes:

```text
/admin/login
/admin/dashboard
/admin/vessels
/admin/templates
/admin/inspections
/admin/reports
/admin/sync-events
/admin/users
/admin/settings
```

Add `/admin/users` page for MVP user management.

### Admin Users Page

Features:

- create inspector
- edit inspector
- deactivate inspector
- reset password manually
- set role
- search users

Fields:

- username
- full name
- employee no
- role
- status

No need for forgot password flow in MVP.

---

## 18. Updated Mobile Settings Screen

Settings now includes:

- profile
- username
- full name
- employee no
- role
- device ID
- app version
- template version
- sync diagnostics
- export debug JSON
- logout

Logout behavior:

- clear token
- keep local drafts by default
- stop sync until login again

---

## 19. Updated Security Rules

Mobile must:

- store token in secure storage
- never store password
- attach bearer token to protected requests
- pause sync when token invalid
- ask login again when unauthorized

Backend must:

- validate token on every protected endpoint
- reject inactive users
- reject unauthorized inspection access
- rate limit login attempts
- avoid returning PocketBase superuser credentials
- avoid exposing raw PocketBase admin APIs
- derive inspector identity from authenticated user

---

## 20. Updated Error Codes

Add:

| Code                | Retryable |
| ------------------- | --------: |
| INVALID_CREDENTIALS |     false |
| UNAUTHORIZED        |     false |
| FORBIDDEN           |     false |
| USER_INACTIVE       |     false |
| SESSION_EXPIRED     |     false |

Common auth error:

```json
{
  "success": false,
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "Session expired. Please login again.",
    "retryable": false
  }
}
```

---

## 21. Updated Mobile Sync Behavior

If backend returns `401` or `SESSION_EXPIRED`:

```text
1. pause sync queue
2. keep local data
3. redirect user to Login
4. after successful login, resume sync queue
```

If backend returns `403`:

```text
1. stop current operation
2. show access denied
3. do not retry automatically
```

---

## 22. Updated Acceptance Criteria

### Mobile

- user can login with username/password
- mobile stores token securely
- mobile opens main tabs after login
- mobile can continue cached local drafts offline after prior login
- mobile pauses sync when session expires
- mobile resumes sync after login again
- logout clears token but keeps drafts
- all protected API calls include bearer token

### Backend

- login endpoint validates username/password
- inactive user cannot login
- protected endpoints reject missing token
- protected endpoints reject invalid token
- backend derives inspector from token
- user cannot access another user inspection unless admin
- idempotency uses `user_id + device_id + local_id`
- submit validates owner and locks inspection
- admin can manage users

### Web Admin

- admin can login
- non-admin cannot access admin pages
- admin can create inspector user
- admin can deactivate inspector user
- admin can reset inspector password manually
- admin can view inspection owner

---

## 23. Final Updated Positioning

Klodware Ship Maintenance MVP now uses username/password authentication.

This makes the product cleaner and closer to production while still keeping PocketBase-first speed.

Mobile remains REST JSON based.

PocketBase remains hidden behind Next.js.

Backend owns authentication, validation, idempotency, PDF generation, and web admin.

React Native owns offline field execution.
