# Photo Upload Multipart Fields

Endpoint:

```http
POST /api/mobile/inspections/:id/photos
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

Fields:

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

Notes:

- `file` must be JPEG for MVP.
- `photo_type` must be `before` or `after`.
- `local_photo_id` is idempotent per inspection.
- Use the server `photo_id` in a later inspection upsert if the mobile draft tracks server photo refs.
