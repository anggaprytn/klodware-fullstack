# Klodware E2E QA Checklist

Run these against a seeded environment with PocketBase configured, at least one active inspector, one inactive user, one admin, one active vessel, and the active superintendent monthly template.

## Auth

- [ ] Valid login returns access token, user profile, and `success: true`.
- [ ] Invalid login returns `401 INVALID_CREDENTIALS`.
- [ ] Inactive user login returns `403 USER_INACTIVE`.
- [ ] Missing bearer token on protected route returns `401 UNAUTHORIZED`.
- [ ] Expired/invalid token returns `401 SESSION_EXPIRED`.

## Bootstrap And Template

- [ ] Bootstrap returns metadata only, not the full template schema.
- [ ] Full template fetch returns schema, 30 sections, 272 normal checklist items, 8 running hour fields, and other comments config.
- [ ] Checksum unchanged path keeps cached full template.
- [ ] Checksum changed path fetches full template again.
- [ ] Existing draft keeps old template ID/version/checksum after a newer template becomes active.

## Inspection

- [ ] Upsert draft creates an inspection and returns server `inspection_id`.
- [ ] Repeated upsert with same `local_id` updates the same inspection.
- [ ] Invalid item score is rejected.
- [ ] Another user cannot access inspection detail, photo upload, submit, PDF status, or PDF download.
- [ ] Locked inspection rejects upsert.

## Photo

- [ ] Upload JPEG succeeds.
- [ ] Repeated upload with same `local_photo_id` returns the existing server photo.
- [ ] Non-JPEG upload is rejected with `415 UNSUPPORTED_MEDIA_TYPE`.
- [ ] Oversized photo is rejected with `413 PAYLOAD_TOO_LARGE`.
- [ ] Photo is linked to the expected `item_template_id` and `photo_type`.

## Submit

- [ ] Missing score validation returns item-level `score` details.
- [ ] Score `3` missing remarks returns item-level `remarks` details.
- [ ] Score `3` missing before photo returns item-level `before_photo` details.
- [ ] Resolved item missing after photo returns item-level `after_photo` details.
- [ ] Valid 272-item submit succeeds.
- [ ] Inspection is locked after submit.
- [ ] PDF is queued after submit.

## PDF

- [ ] Worker generates PDF for queued report.
- [ ] PDF status becomes `ready`.
- [ ] Authenticated download returns `application/pdf`.
- [ ] Signed token download returns `application/pdf`.
- [ ] Invalid signed token is rejected.
- [ ] Expired signed token is rejected.
- [ ] Regenerate PDF queues a new report.
- [ ] Failed generation path reports `pdf_status: failed`.

## Admin

- [ ] Admin login succeeds.
- [ ] Users page loads.
- [ ] Vessels page loads.
- [ ] Templates page loads.
- [ ] Inspections list/detail loads synced inspection data.
- [ ] Reports page loads PDF report status.
- [ ] Sync events page/data shows validation and sync events.
