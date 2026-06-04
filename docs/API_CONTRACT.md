# Klodware Mobile REST API Contract

Source of truth: `docs/PRD.md`. Mobile clients must call only these Next.js REST routes. Do not call PocketBase directly.

Base URL is environment-specific, for example `http://localhost:3000` in local development. All responses use this envelope unless the endpoint returns binary PDF content:

```json
{
  "success": true,
  "server_time": "2026-06-04T06:30:00.000Z",
  "data": {}
}
```

Errors use:

```json
{
  "success": false,
  "server_time": "2026-06-04T06:30:00.000Z",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing bearer token.",
    "retryable": false
  }
}
```

Common protected headers:

```http
Authorization: Bearer <access_token>
X-Device-Id: android-device-uuid
X-App-Version: 1.0.0
X-Request-Id: 9e77c660-89e1-4de7-9b19-78c1d7f6c8c5
```

`Authorization` is required for protected routes. The other headers are expected for traceability and sync diagnostics.

## Mobile Auth Behavior

Mobile stores the login `access_token` in secure storage such as Keychain or Keystore. Protected requests send `Authorization: Bearer <access_token>`.

`401` means the sync queue should pause and the app should redirect to login when online. `403` means the operation is not allowed; stop the operation and show access denied or account inactive messaging. Logout clears the token and stops the sync queue, but keeps local drafts unless the user explicitly clears local data.

Inactive users cannot login. If a previously active user's token is refreshed after the account becomes inactive, protected routes return `403` with `USER_INACTIVE`.

The backend derives `inspector_user_id`, `inspector_name`, and `inspector_employee_no` from the bearer token. Mobile must not send or trust inspector identity fields as authority.

## Bootstrap And Cache Behavior

Mobile should render cached data first, then call `GET /api/mobile/bootstrap` in the background. Bootstrap returns metadata only: app config, active template metadata, active vessel catalog count, and current user profile.

If the cached active template checksum is unchanged, do not fetch the full template. If the checksum changed or the template is not cached, fetch `GET /api/mobile/checklist-templates/:id`.

Existing drafts keep their locked `template_id`, `template_version`, and `template_checksum`. New inspections use the latest active template returned by bootstrap.

## Inspection Sync Order

1. Login
2. Bootstrap
3. Fetch vessels
4. Fetch full template if checksum changed or not cached
5. Create local inspection draft on mobile
6. Fill checklist offline
7. Upsert inspection JSON
8. Store server `inspection_id`
9. Upload photos
10. Upsert inspection again with server photo refs if needed
11. Submit inspection
12. Poll PDF status
13. Download/share PDF when ready

## Endpoints

### GET /api/mobile/health

Auth: public

Headers:

```http
Accept: application/json
```

Request body: none

Response:

```json
{
  "success": true,
  "server_time": "2026-06-04T06:30:00.000Z",
  "data": {
    "status": "ok",
    "service": "klodware-api"
  }
}
```

Error example:

```json
{
  "success": false,
  "server_time": "2026-06-04T06:30:00.000Z",
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Service unavailable.",
    "retryable": true
  }
}
```

Mobile notes: use as a lightweight connectivity check only. Login/session validation still requires auth endpoints.

### POST /api/mobile/auth/login

Auth: public

Headers:

```http
Content-Type: application/json
X-Device-Id: android-device-uuid
X-App-Version: 1.0.0
X-Request-Id: 9e77c660-89e1-4de7-9b19-78c1d7f6c8c5
```

Request body:

```json
{
  "username": "inspector.dev",
  "password": "correct-horse-battery",
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
    "access_token": "eyJhbGciOi...",
    "token_type": "Bearer",
    "expires_at": "2026-06-05T06:30:00.000Z",
    "user": {
      "id": "u_inspector_001",
      "username": "inspector.dev",
      "full_name": "Dev Inspector",
      "employee_no": "EMP-001",
      "role": "inspector",
      "status": "active"
    }
  }
}
```

Error example:

```json
{
  "success": false,
  "server_time": "2026-06-04T06:30:00.000Z",
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Username or password is incorrect.",
    "retryable": false
  }
}
```

Mobile notes: store only the token and profile. Never store the password. `RATE_LIMITED` returns `Retry-After`.

### GET /api/mobile/auth/me

Auth: protected

Headers:

```http
Authorization: Bearer <access_token>
X-Device-Id: android-device-uuid
X-App-Version: 1.0.0
X-Request-Id: 9e77c660-89e1-4de7-9b19-78c1d7f6c8c5
```

Request body: none

Response:

```json
{
  "success": true,
  "server_time": "2026-06-04T06:30:00.000Z",
  "data": {
    "user": {
      "id": "u_inspector_001",
      "username": "inspector.dev",
      "full_name": "Dev Inspector",
      "employee_no": "EMP-001",
      "role": "inspector",
      "status": "active"
    }
  }
}
```

Error example:

```json
{
  "success": false,
  "server_time": "2026-06-04T06:30:00.000Z",
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "Session expired. Please login again.",
    "retryable": false
  }
}
```

Mobile notes: use this to validate an online session. If offline, use cached profile until sync resumes.

### GET /api/mobile/bootstrap

Auth: protected

Headers: common protected headers

Request body: none

Response:

```json
{
  "success": true,
  "server_time": "2026-06-04T06:30:00.000Z",
  "data": {
    "app_config": {
      "api_contract": "mobile-rest-json-v1",
      "inspection_execution": "mobile-only"
    },
    "active_template": {
      "id": "superintendent-monthly-v1",
      "record_id": "tpl_record_001",
      "type": "superintendent-monthly",
      "name": "Superintendent Monthly Inspection Checklist",
      "version": 1,
      "checksum": "sha256:template-checksum",
      "active": true,
      "sections_count": 30,
      "items_count": 272
    },
    "vessel_catalog": {
      "count": 1,
      "active_only": true
    },
    "user": {
      "id": "u_inspector_001",
      "username": "inspector.dev",
      "full_name": "Dev Inspector",
      "employee_no": "EMP-001",
      "role": "inspector",
      "status": "active"
    }
  }
}
```

Error example:

```json
{
  "success": false,
  "server_time": "2026-06-04T06:30:00.000Z",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing bearer token.",
    "retryable": false
  }
}
```

Mobile notes: bootstrap is not the full template and not the vessel list. Use it to decide whether cached template/vessel data needs refresh.

### GET /api/mobile/vessels

Auth: protected

Headers: common protected headers

Request body: none

Response:

```json
{
  "success": true,
  "server_time": "2026-06-04T06:30:00.000Z",
  "data": {
    "vessels": [
      {
        "id": "vessel_001",
        "name": "Klodware Dev Vessel",
        "imo": "0000001",
        "mmsi": "525000001",
        "call_sign": "KLOD",
        "flag": "Indonesia",
        "year_built": 2020,
        "status": "active",
        "image": ""
      }
    ]
  }
}
```

Error example:

```json
{
  "success": false,
  "server_time": "2026-06-04T06:30:00.000Z",
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "Session expired. Please login again.",
    "retryable": false
  }
}
```

Mobile notes: cache this list locally. The endpoint returns active vessels only.

### GET /api/mobile/checklist-templates/:id

Auth: protected

Headers: common protected headers

Request body: none

Response:

```json
{
  "success": true,
  "server_time": "2026-06-04T06:30:00.000Z",
  "data": {
    "template": {
      "id": "superintendent-monthly-v1",
      "record_id": "tpl_record_001",
      "type": "superintendent-monthly",
      "name": "Superintendent Monthly Inspection Checklist",
      "version": 1,
      "checksum": "sha256:template-checksum",
      "active": true,
      "sections_count": 30,
      "items_count": 272,
      "schema": {
        "rating_options": ["1", "2", "3", "4", "NA"],
        "sections": [
          {
            "code": "10",
            "name": "Hull",
            "items": [
              {
                "id": "10-draft-mark",
                "type": "rating_item",
                "label": "Draft marks visible and readable",
                "section_code": "10"
              }
            ]
          }
        ],
        "running_hours": [
          {
            "id": "main-engine-port",
            "label": "Main Engine Port"
          }
        ],
        "other_comments": {
          "type": "textarea",
          "label": "Other Comments"
        }
      }
    }
  }
}
```

Error example:

```json
{
  "success": false,
  "server_time": "2026-06-04T06:30:00.000Z",
  "error": {
    "code": "NOT_FOUND",
    "message": "Checklist template was not found.",
    "retryable": false
  }
}
```

Mobile notes: cache by `id`, `version`, and `checksum`. Drafts must keep the template identity they were created with.

### POST /api/mobile/inspections/upsert

Auth: protected

Headers:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
X-Device-Id: android-device-uuid
X-App-Version: 1.0.0
X-Request-Id: 9e77c660-89e1-4de7-9b19-78c1d7f6c8c5
```

Request body:

```json
{
  "local_id": "local-insp-20260604-001",
  "device_id": "android-device-uuid",
  "template_id": "superintendent-monthly-v1",
  "template_version": 1,
  "template_checksum": "sha256:template-checksum",
  "vessel_id": "vessel_001",
  "place": "Jakarta Anchorage",
  "started_at": "2026-06-04T02:00:00.000Z",
  "updated_at": "2026-06-04T04:00:00.000Z",
  "status": "draft",
  "items": [
    {
      "item_template_id": "10-draft-mark",
      "section_code": "10",
      "score": "3",
      "remarks": "Draft mark faded, needs repainting.",
      "is_resolved": false,
      "photo_refs": [
        {
          "local_photo_id": "local-photo-001",
          "server_photo_id": "photo_001",
          "type": "before"
        }
      ],
      "updated_at": "2026-06-04T03:00:00.000Z"
    }
  ],
  "running_hours": [
    {
      "equipment": "Main Engine Port",
      "value": 1200
    }
  ],
  "other_comments": "General vessel condition acceptable with minor findings."
}
```

Response:

```json
{
  "success": true,
  "server_time": "2026-06-04T06:30:00.000Z",
  "data": {
    "inspection_id": "insp_001",
    "local_id": "local-insp-20260604-001",
    "status": "draft",
    "pdf_status": "not_requested",
    "synced_at": "2026-06-04T06:30:00.000Z"
  }
}
```

Error example:

```json
{
  "success": false,
  "server_time": "2026-06-04T06:30:00.000Z",
  "error": {
    "code": "CONFLICT",
    "message": "Checklist template checksum does not match the server template.",
    "retryable": false
  }
}
```

Mobile notes: idempotency is `user_id + device_id + local_id`. Repeated upserts with the same local inspection update the same draft until it is submitted/locked. The dev generator can create a full valid 272-item payload:

```bash
npx tsx scripts/dev-create-valid-inspection-payload.ts > /tmp/inspection-payload.json
```

### POST /api/mobile/inspections/:id/photos

Auth: protected

Headers:

```http
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
X-Device-Id: android-device-uuid
X-App-Version: 1.0.0
X-Request-Id: 9e77c660-89e1-4de7-9b19-78c1d7f6c8c5
```

Request body: multipart form fields

```text
file=@before.jpg;type=image/jpeg
local_photo_id=local-photo-001
device_id=android-device-uuid
item_template_id=10-draft-mark
section_code=10
photo_type=before
captured_at=2026-06-04T03:05:00.000Z
latitude=-6.125
longitude=106.825
vessel_id=vessel_001
checksum=sha256:photo-checksum
metadata_json={"camera":"rear","note":"faded draft mark"}
```

Response:

```json
{
  "success": true,
  "server_time": "2026-06-04T06:30:00.000Z",
  "data": {
    "photo_id": "photo_001",
    "local_photo_id": "local-photo-001",
    "inspection_id": "insp_001",
    "item_template_id": "10-draft-mark",
    "photo_type": "before",
    "uploaded_at": "2026-06-04T06:30:00.000Z"
  }
}
```

Error example:

```json
{
  "success": false,
  "server_time": "2026-06-04T06:30:00.000Z",
  "error": {
    "code": "UNSUPPORTED_MEDIA_TYPE",
    "message": "Only image/jpeg uploads are supported for MVP.",
    "retryable": false
  }
}
```

Mobile notes: only JPEG is supported. Re-uploading the same `local_photo_id` for the same inspection is idempotent. Upload photos before final submit.

### POST /api/mobile/inspections/:id/submit

Auth: protected

Headers:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
X-Device-Id: android-device-uuid
X-App-Version: 1.0.0
X-Request-Id: 9e77c660-89e1-4de7-9b19-78c1d7f6c8c5
```

Request body:

```json
{
  "device_id": "android-device-uuid",
  "submitted_at": "2026-06-04T06:35:00.000Z"
}
```

Response:

```json
{
  "success": true,
  "server_time": "2026-06-04T06:35:00.000Z",
  "data": {
    "inspection_id": "insp_001",
    "status": "submitted",
    "locked": true,
    "pdf_status": "queued",
    "pdf_report_id": "pdf_001"
  }
}
```

Error example:

```json
{
  "success": false,
  "server_time": "2026-06-04T06:35:00.000Z",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Inspection is not complete",
    "retryable": false,
    "details": [
      {
        "item_template_id": "10-draft-mark",
        "field": "before_photo",
        "message": "Before photo is required for score 3 or 4"
      }
    ]
  }
}
```

Mobile notes: submit validates every template item, remarks for score `3` or `4`, before photos for findings, and after photos for resolved findings. A submitted inspection is locked and cannot be changed.

### GET /api/mobile/inspections

Auth: protected

Headers: common protected headers

Query parameters: optional `vessel_id`, `status`, `pdf_status`

Request body: none

Response:

```json
{
  "success": true,
  "server_time": "2026-06-04T06:40:00.000Z",
  "data": {
    "inspections": [
      {
        "inspection_id": "insp_001",
        "local_id": "local-insp-20260604-001",
        "vessel_id": "vessel_001",
        "vessel_name": "Klodware Dev Vessel",
        "status": "submitted",
        "pdf_status": "ready",
        "submitted_at": "2026-06-04T06:35:00.000Z",
        "updated_at": "2026-06-04T06:39:00.000Z",
        "synced_at": "2026-06-04T06:35:00.000Z",
        "findings_count": 1,
        "drydock_count": 0,
        "completed_items": 272,
        "total_items": 272
      }
    ]
  }
}
```

Error example:

```json
{
  "success": false,
  "server_time": "2026-06-04T06:40:00.000Z",
  "error": {
    "code": "USER_INACTIVE",
    "message": "User account is inactive.",
    "retryable": false
  }
}
```

Mobile notes: inspectors see their own inspections. Admin users may see all inspections.

### GET /api/mobile/inspections/:id

Auth: protected

Headers: common protected headers

Request body: none

Response:

```json
{
  "success": true,
  "server_time": "2026-06-04T06:40:00.000Z",
  "data": {
    "inspection": {
      "inspection_id": "insp_001",
      "local_id": "local-insp-20260604-001",
      "device_id": "android-device-uuid",
      "vessel_id": "vessel_001",
      "template_id": "superintendent-monthly-v1",
      "template_version": 1,
      "template_checksum": "sha256:template-checksum",
      "inspector_name": "Dev Inspector",
      "inspector_employee_no": "EMP-001",
      "place": "Jakarta Anchorage",
      "status": "submitted",
      "locked": true,
      "pdf_status": "ready",
      "started_at": "2026-06-04T02:00:00.000Z",
      "submitted_at": "2026-06-04T06:35:00.000Z",
      "synced_at": "2026-06-04T06:35:00.000Z",
      "locked_at": "2026-06-04T06:35:00.000Z"
    },
    "vessel": {
      "id": "vessel_001",
      "name": "Klodware Dev Vessel",
      "imo": "0000001",
      "status": "active"
    },
    "template": {
      "id": "superintendent-monthly-v1",
      "record_id": "tpl_record_001",
      "name": "Superintendent Monthly Inspection Checklist",
      "version": 1,
      "checksum": "sha256:template-checksum",
      "sections_count": 30,
      "items_count": 272
    },
    "summary": {
      "total_items": 272,
      "completed_items": 272,
      "findings_count": 1
    },
    "raw_payload_json": {},
    "photos": [
      {
        "photo_id": "photo_001",
        "local_photo_id": "local-photo-001",
        "inspection_id": "insp_001",
        "item_template_id": "10-draft-mark",
        "section_code": "10",
        "photo_type": "before",
        "captured_at": "2026-06-04T03:05:00.000Z",
        "uploaded_at": "2026-06-04T06:30:00.000Z",
        "latitude": -6.125,
        "longitude": 106.825,
        "checksum": "sha256:photo-checksum",
        "metadata_json": {
          "camera": "rear"
        }
      }
    ],
    "pdf_status": "ready"
  }
}
```

Error example:

```json
{
  "success": false,
  "server_time": "2026-06-04T06:40:00.000Z",
  "error": {
    "code": "FORBIDDEN",
    "message": "You are not allowed to access this inspection.",
    "retryable": false
  }
}
```

Mobile notes: use detail for reports/review/debug display, not for web-based inspection editing.

### GET /api/mobile/inspections/:id/pdf

Auth: protected

Headers: common protected headers

Request body: none

Response:

```json
{
  "success": true,
  "server_time": "2026-06-04T06:45:00.000Z",
  "data": {
    "inspection_id": "insp_001",
    "pdf_status": "ready",
    "pdf_report_id": "pdf_001",
    "file_size_bytes": 245760,
    "generated_at": "2026-06-04T06:44:00.000Z",
    "pdf_url": "http://localhost:3000/api/mobile/inspections/insp_001/pdf/download?token=signed-token",
    "expires_at": "2026-06-04T07:00:00.000Z"
  }
}
```

Error example:

```json
{
  "success": false,
  "server_time": "2026-06-04T06:45:00.000Z",
  "error": {
    "code": "NOT_FOUND",
    "message": "Inspection was not found.",
    "retryable": false
  }
}
```

Mobile notes: poll until `pdf_status` is `ready` or `failed`. `pdf_url` is null until ready.

### GET /api/mobile/inspections/:id/pdf/download

Auth: protected bearer token or signed `token` query parameter

Headers for bearer mode:

```http
Authorization: Bearer <access_token>
X-Device-Id: android-device-uuid
X-App-Version: 1.0.0
X-Request-Id: 9e77c660-89e1-4de7-9b19-78c1d7f6c8c5
```

Request body: none

Response: `200 application/pdf` binary content with `Content-Disposition: inline`.

Error example:

```json
{
  "success": false,
  "server_time": "2026-06-04T07:01:00.000Z",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired PDF download token.",
    "retryable": false
  }
}
```

Mobile notes: prefer the signed `pdf_url` returned by the PDF status endpoint for share/download flows. Use bearer mode when rendering inside an authenticated app view.

### POST /api/mobile/inspections/:id/pdf/regenerate

Auth: protected

Headers:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
X-Device-Id: android-device-uuid
X-App-Version: 1.0.0
X-Request-Id: 9e77c660-89e1-4de7-9b19-78c1d7f6c8c5
```

Request body: `{}` or empty JSON body

Response:

```json
{
  "success": true,
  "server_time": "2026-06-04T06:50:00.000Z",
  "data": {
    "inspection_id": "insp_001",
    "pdf_status": "queued",
    "pdf_report_id": "pdf_002"
  }
}
```

Error example:

```json
{
  "success": false,
  "server_time": "2026-06-04T06:50:00.000Z",
  "error": {
    "code": "CONFLICT",
    "message": "Only submitted inspections can have PDF reports regenerated.",
    "retryable": false
  }
}
```

Mobile notes: use only for retry/recovery flows after a submitted inspection has a failed or stale PDF.
