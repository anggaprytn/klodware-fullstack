# Coolify Docker Compose Deploy

Coolify supports deploying Docker Compose applications directly from a compose file. Use `docker-compose.coolify.yml` for this project.

## Services

- `app`: Next.js web admin and mobile REST API, exposed on port `3000`.
- `pdf-worker`: Playwright PDF worker, internal only.
- `pocketbase`: PocketBase datastore, internal only on port `8090`.
- `setup`: optional one-shot profile to create/verify collections and seed template/vessels.

PocketBase must stay hidden behind Next.js route handlers. Do not assign a public domain to the `pocketbase` service for normal operation.

## Coolify Setup

1. Create a new Docker Compose application in Coolify from this repository.
2. Set the compose file path to `docker-compose.coolify.yml`.
3. Set the public domain on the `app` service only.
4. Add environment variables from `.env.coolify.example` in Coolify.
5. Set `APP_BASE_URL` to the public HTTPS URL of the `app` service.
6. Deploy.

Required secrets:

```text
PB_SUPERUSER_EMAIL
PB_SUPERUSER_PASSWORD
APP_BASE_URL
PDF_DOWNLOAD_SECRET
```

Use a long random value for `PDF_DOWNLOAD_SECRET`.

## First PocketBase Superuser

On a fresh PocketBase volume, create the superuser before running setup. Use Coolify's terminal for the `pocketbase` service:

```bash
/pb/pocketbase superuser create "$PB_SUPERUSER_EMAIL" "$PB_SUPERUSER_PASSWORD" --dir=/pb/pb_data
```

If your PocketBase version reports a different CLI command, use the command shown by:

```bash
/pb/pocketbase superuser --help
```

## Run Setup And Seeds

After the first deploy and superuser creation, run the setup profile once from a terminal:

```bash
docker compose -f docker-compose.coolify.yml --profile setup run --rm setup
```

Equivalent commands inside the `app` container:

```bash
npm run setup:pocketbase
npm run seed:template
npm run seed:vessels
```

## Operational Notes

- Only `app` needs a public route.
- `pdf-worker` should keep running with `--watch`.
- PocketBase data is stored in the `pocketbase-data` volume.
- Back up the PocketBase volume before upgrading PocketBase.
- The active mobile API remains `/api/mobile/*`; mobile must not call PocketBase directly.

## Local Compose Check

For local validation with Docker:

```bash
docker compose -f docker-compose.coolify.yml --env-file .env.coolify.example build
docker compose -f docker-compose.coolify.yml --env-file .env.coolify.example up app pdf-worker pocketbase
```

For real deployments, replace all example secrets in Coolify.
