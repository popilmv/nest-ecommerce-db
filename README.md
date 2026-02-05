# Transactional Order Creation + SQL Optimization (NestJS + PostgreSQL + TypeORM)

## Goal
Implement safe `createOrder` for an e-commerce backend:
- no partial writes (transaction)
- idempotency (double-submit safe)
- oversell protection (concurrency)

---

## Tech stack
- NestJS
- PostgreSQL (local)
- TypeORM
- QueryRunner transactions
- Pessimistic locking (row-level)

```
npm i @nestjs/typeorm typeorm pg
npm i @nestjs/config
```

I use local PosgreSQL so create new DB:
```
CREATE DATABASE ecommerce_db_hw;
```
## RUN API
```
npm run start:dev
```

## Seed demo data
```
npm run seed
```
<img width="474" height="195" alt="image" src="https://github.com/user-attachments/assets/4226256d-5336-435e-b655-6281d398211b" />

## Transactional createOrder
```
curl -i \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-key-1" \
  -d "{
    \"userId\":\"e74c8128-ec97-40ab-bc1c-7f420d541a2c\",
    \"items\":[{\"productId\":\"b6106263-a610-4dc8-9be6-74f42a87ed4d\",\"quantity\":1}]
  }" \
  http://localhost:3000/orders
```

<img width="1601" height="486" alt="image" src="https://github.com/user-attachments/assets/443d82bc-e9fb-44bb-b6ee-8feebb094ba1" />


## No partial writes

Trigger a business error:




<img width="407" height="108" alt="image" src="https://github.com/user-attachments/assets/64faea3b-7738-44aa-b0ce-496b4af3af53" />


<img width="1645" height="276" alt="image" src="https://github.com/user-attachments/assets/06b74071-4346-4768-9208-d90807d3e212" />


## Before / After
```
EXPLAIN ANALYZE
SELECT id, "userId", status, "createdAt"
FROM orders
WHERE status = 'created'
  AND "createdAt" >= NOW() - interval '7 days'
ORDER BY "createdAt" DESC
LIMIT 50;
```
<img width="843" height="316" alt="image" src="https://github.com/user-attachments/assets/65583344-c878-4493-ac43-9c032712fcae" />


```
CREATE INDEX idx_orders_status_created_at
ON orders (status, "createdAt" DESC);
```

<img width="779" height="328" alt="image" src="https://github.com/user-attachments/assets/82a7688b-ce88-4a90-89ce-28e6377f8cc9" />

