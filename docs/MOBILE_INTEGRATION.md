# Mobile Integration Guide

This backend repo exposes the mobile API. The React Native app lives in a separate codebase and owns all inspection execution UI, offline draft storage, and autosave.

Mobile must not call PocketBase directly. Mobile must not store the password. Web admin does not fill inspection.

## Base URL

Configure one API base URL per environment:

```text
Local: http://localhost:3000
Staging: https://<staging-host>
Production: https://<production-host>
```

All mobile endpoints are under `/api/mobile`.

## Auth Flow

1. User enters username and password.
2. Mobile sends `POST /api/mobile/auth/login`.
3. Backend validates PocketBase auth behind the Next.js facade.
4. Mobile stores `access_token` securely.
5. Protected requests include `Authorization: Bearer <access_token>`.
6. Logout clears the token and stops sync, but keeps local drafts unless the user explicitly clears local data.

Use secure storage such as Keychain or Keystore for the access token. Store cached profile in local DB or secure storage. Never store raw passwords, PocketBase credentials, admin credentials, superuser credentials, or PocketBase tokens.

## Common Headers

```http
Authorization: Bearer <access_token>
Content-Type: application/json
X-Device-Id: android-device-uuid
X-App-Version: 1.0.0
X-Request-Id: uuid
```

Omit `Content-Type` for GET requests and set `multipart/form-data` for photo uploads.

## Bootstrap And Cache

Mobile renders cached local data first, then calls `GET /api/mobile/bootstrap` in the background. Bootstrap returns metadata only: API contract, active template metadata, active vessel catalog count, and current user profile.

If the local template checksum matches `active_template.checksum`, keep the cached full template. If it differs or no full template exists, fetch `GET /api/mobile/checklist-templates/:id`.

Fetch active vessels with `GET /api/mobile/vessels` and cache them locally.

## Local DB Expectations

Mobile owns the local database for:

- cached user profile
- device ID
- active template metadata and full schema
- vessel catalog
- inspection drafts
- item scores and remarks
- running hours
- other comments
- local photo paths and upload status
- sync queue state

Mobile owns offline draft/autosave. Backend is source of truth after submit.

## Template Locking

When starting an inspection, copy the current active `template_id`, `template_version`, and `template_checksum` into the local draft. That identity must not change for that draft, even if bootstrap later reports a newer active template.

New inspections use the latest active template metadata from bootstrap.

## Inspection Local ID

Every local draft must have a stable `local_id`. The backend idempotency key is based on authenticated `user_id`, `device_id`, and `local_id`.

After `POST /api/mobile/inspections/upsert` succeeds, store the returned `inspection_id`. Continue using the same `local_id` and `inspection_id` for retries and subsequent photo/submit operations.

## Photo Upload

Upload photos after the inspection JSON has been upserted and a server `inspection_id` exists. The endpoint accepts JPEG only.

Each photo needs a stable `local_photo_id`. Repeated upload of the same `local_photo_id` for the same inspection returns the existing server photo record.

For score `3` or `4`, submit validation requires a before photo. If a finding is marked resolved, submit validation also requires an after photo.

## Submit

Before submit, upsert the latest inspection JSON and upload required photos. Submit locks the inspection, queues PDF generation, and prevents further upserts/photo uploads.

Submit validation checks every template item, score validity, required remarks, required before photos, resolved after photos, template checksum, vessel existence, ownership, and lock state.

## PDF Polling

After submit, poll `GET /api/mobile/inspections/:id/pdf` until:

- `pdf_status: "ready"`: download/share `pdf_url`
- `pdf_status: "failed"`: show retry/recovery option
- `pdf_status: "queued"` or `"generating"`: keep polling with backoff

The download endpoint returns binary PDF. JSON errors still use the shared envelope.

## Error Handling

Use `error.code` for behavior, not only HTTP status.

- `401`: pause sync queue and redirect to login when online.
- `403`: stop the operation and show access denied/account inactive.
- `400`/`VALIDATION_ERROR`: keep draft local, show field-level issues when available.
- `409`/`CONFLICT`: refresh server state; locked inspections cannot be changed.
- `413`: compress/reduce photo size.
- `415`: convert to JPEG before upload.
- `429`: wait for `Retry-After`.
- `500`/`502`: retry with backoff if `retryable` is true.

## Offline Queue And Retry

Queue operations in this order:

1. upsert inspection JSON
2. upload photos
3. upsert inspection JSON again with server photo refs if needed
4. submit inspection
5. poll PDF status
6. download/share PDF

Retries should preserve `local_id`, `local_photo_id`, and `X-Request-Id` per attempt. Do not retry terminal validation/access errors automatically.

## Known Backend Constraints

- Next.js route handlers are the only supported mobile API surface.
- PocketBase remains hidden behind the backend.
- Inspection execution belongs to React Native mobile only.
- Web admin is read-only/review-oriented for synced inspections, photos, PDFs, and sync debugging.
- The active template currently contains 30 sections, 272 normal checklist items, 8 running hour fields, and an other comments textarea.
- Only JPEG inspection photo uploads are supported for MVP.
- Complex RBAC, email notifications, analytics dashboards, and web inspection editors are out of scope.
