# NestJS E-commerce Backend (Postgres + TypeORM) — Transactions + Files (S3 Presigned Upload)

This repo contains:
1) **Transactional order creation** (transactions, idempotency, concurrency safety)
2) **Homework 27: Files** — secure image upload to S3 via **presigned URLs** with DB metadata, lifecycle statuses, access control, and domain integration.

---

## Tech stack
- NestJS
- PostgreSQL
- TypeORM
- AWS SDK v3 (S3)
- MinIO for local reproducible S3

---

# Part A — Transactional Order Creation + SQL Optimization

## Goal
Implement safe `createOrder` for an e-commerce backend:
- no partial writes (transaction)
- idempotency (double-submit safe)
- oversell protection (concurrency)

## GraphQL
GraphQL endpoint: `http://localhost:21164/graphql`

Homework notes (schema/resolvers/dataloader + N+1 proof): see **homework07.md**.

---

# Part B — Homework 27: Files (S3 + Presigned URLs)

## Goal
Implement safe image upload to S3 through **presigned PUT**, so that:
- file bytes go directly to S3 (backend does **not** proxy bytes)
- metadata is stored in Postgres (`FileRecord`)
- lifecycle is tracked: `pending -> ready`
- access is enforced (roles/scopes + ownership)
- at least one domain is integrated (Products or Users)
- delivery URL is available (dev: presigned GET; ideal: CloudFront)

---

## What is implemented
- ✅ `FileRecord` persisted in Postgres (`file_records`)
  - fields: `ownerId`, `entityId`, `key`, `contentType`, `size`, `status (pending|ready)`, `visibility (private|public)`
- ✅ Backend-only key generation (`products/{productId}/images/{uuid}.png`)
  - user **cannot** provide a custom key/path
- ✅ `POST /files/presign`
  - access check: product images require `admin`
  - creates `FileRecord` with `status=pending`
  - returns **presigned PUT uploadUrl**
- ✅ Direct upload: `PUT uploadUrl` -> S3/MinIO (no backend proxy)
- ✅ `POST /files/complete`
  - ownership check (only owner can complete)
  - prevents re-complete (`409 File is not pending`)
  - updates `pending -> ready`
  - domain integration: `products.imageFileId = fileId`
- ✅ Delivery:
  - `GET /files/:id` returns `{ url }`
  - in dev (MinIO/private): returns **presigned GET**
  - optional: CloudFront if `CLOUDFRONT_BASE_URL` is set

---

## Dev auth model (for homework)
Send request headers:
- `x-user-id: <uuid>`
- `x-user-role: admin|user`

---

## Local quick start (reproducible end-to-end)
This setup matches the proven local run (ports and bucket names below).

### 1) Start Postgres (clean)
```bash
docker rm -f new_img 2>/dev/null || true

docker run -d --name new_img \
  -e POSTGRES_DB=app \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 26432:5432 \
  postgres:16-alpine


Create bucket uploads:
```
node - <<'NODE'
const { S3Client, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

(async () => {
  const client = new S3Client({
    region: 'us-east-1',
    endpoint: 'http://127.0.0.1:29164',
    forcePathStyle: true,
    credentials: { accessKeyId: 'minio', secretAccessKey: 'minio12345' },
  });

  const Bucket = 'uploads';
  try {
    await client.send(new HeadBucketCommand({ Bucket }));
    console.log('bucket exists:', Bucket);
  } catch {
    await client.send(new CreateBucketCommand({ Bucket }));
    console.log('bucket created:', Bucket);
  }
})();
NODE
```

Install + build

```
npm ci
npm run build
```

DB schema + seed
```
env DB_HOST=127.0.0.1 DB_PORT=26432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=app \
  npm run migrate

env DB_HOST=127.0.0.1 DB_PORT=26432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=app \
  npm run seed
```


Start API

```
env PORT=21164 \
DB_HOST=127.0.0.1 DB_PORT=26432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=app \
S3_ENDPOINT=http://127.0.0.1:29164 S3_FORCE_PATH_STYLE=true S3_BUCKET=uploads \
AWS_REGION=us-east-1 AWS_ACCESS_KEY_ID=minio AWS_SECRET_ACCESS_KEY=minio12345 \
FILES_PRESIGN_EXPIRES_SEC=120 \
npm run start
```


Runtime verification (E2E): presign -> upload -> complete -> view URL
Pick a PRODUCT_ID
```
PRODUCT_ID=$(docker exec -i new_img psql -U postgres -d app -At -c "select id from products limit 1;")
echo "PRODUCT_ID=$PRODUCT_ID"
```
Presign (admin for product)
```
BASE_URL=http://127.0.0.1:21164
USER_ID=11111111-1111-1111-1111-111111111111
PRESIGN_JSON=$(curl -sS -X POST "$BASE_URL/files/presign" \
  -H "content-type: application/json" \
  -H "x-user-id: $USER_ID" \
  -H "x-user-role: admin" \
  -d "{\"entityType\":\"product\",\"entityId\":\"$PRODUCT_ID\",\"contentType\":\"image/png\",\"size\":3,\"visibility\":\"private\"}")
echo "PRESIGN_JSON=$PRESIGN_JSON"
FILE_ID=$(node -e "const fs=require('fs');const o=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(o.fileId)" <<<"$PRESIGN_JSON")
UPLOAD_URL=$(node -e "const fs=require('fs');const o=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(o.uploadUrl)" <<<"$PRESIGN_JSON")
echo "FILE_ID=$FILE_ID"
echo "UPLOAD_URL=$UPLOAD_URL"
```

Expected response contains:
fileId

key like products/<productId>/images/<uuid>.png

uploadUrl (presigned PUT)

 Direct upload to S3 (PUT uploadUrl)
```
printf 'PNG' > /tmp/demo.png

curl -i -X PUT "$UPLOAD_URL" \
  -H "Content-Type: image/png" \
  --data-binary "@/tmp/demo.png"
```

Expected: HTTP/1.1 200 OK (MinIO)

Complete (pending -> ready)
```
curl -i -X POST "$BASE_URL/files/complete" \
  -H "content-type: application/json" \
  -H "x-user-id: $USER_ID" \
  -H "x-user-role: admin" \
  -d "{\"fileId\":\"$FILE_ID\"}"
```

Expected: HTTP/1.1 201 Created and body { "ok": true }

DB proof (status + integration)

FileRecord is ready:

```
docker exec -i new_img psql -U postgres -d app -c \
"select id, status, key, \"entityId\", \"ownerId\" from file_records where id='$FILE_ID';"
docker exec -i new_img psql -U postgres -d app -c \
"select id, \"imageFileId\" from products where id='$PRODUCT_ID';"
```

Delivery URL (view)
```
URL_JSON=$(curl -sS "$BASE_URL/files/$FILE_ID" \
  -H "x-user-id: $USER_ID" \
  -H "x-user-role: admin")

echo "$URL_JSON"

VIEW_URL=$(node -e "const fs=require('fs');const o=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(o.url || o.viewUrl || '')" <<<"$URL_JSON")
echo "VIEW_URL=$VIEW_URL"

curl -i "$VIEW_URL"
```

Expected:
GET /files/:id returns { "url": "..." }

curl -i "$VIEW_URL" returns HTTP/1.1 200 OK

Security / edge cases (negative tests)
A) Another user cannot complete чужий файл (ownership)
OTHER_USER_ID=22222222-2222-2222-2222-222222222222

```
curl -i -X POST "$BASE_URL/files/complete" \
  -H "content-type: application/json" \
  -H "x-user-id: $OTHER_USER_ID" \
  -H "x-user-role: admin" \
  -d "{\"fileId\":\"$FILE_ID\"}"
```

Expected: HTTP/1.1 403 Forbidden

Repeat complete (already ready)
```
curl -i -X POST "$BASE_URL/files/complete" \
  -H "content-type: application/json" \
  -H "x-user-id: $USER_ID" \
  -H "x-user-role: admin" \
  -d "{\"fileId\":\"$FILE_ID\"}"
```  

Expected: HTTP/1.1 409 Conflict (File is not pending)

Expected status codes summary
POST /files/presign without x-user-id -> 401
POST /files/presign as non-admin for entityType=product -> 403
PUT uploadUrl -> 200/204
POST /files/complete чужий fileId -> 403 (or 404 if hiding existence)
POST /files/complete already-ready -> 409
GET /files/:id -> 200 with { url } and curl url -> 200


