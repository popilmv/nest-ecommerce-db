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
## GraphQL

GraphQL endpoint: `http://localhost:3000/graphql`

Homework notes (schema/resolvers/dataloader + N+1 proof): see **homework07.md**.

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

SQL Optimization (Orders by status and date)
Hot query

```
SELECT id, "userId", status, "createdAt"
FROM orders
WHERE status = 'created'
  AND "createdAt" >= NOW() - interval '7 days'
ORDER BY "createdAt" DESC
LIMIT 50;
```
This query is used to fetch the latest created orders for admin views with filtering by status and creation date.

Before optimization (no index)
Execution plan highlights:
PostgreSQL performed a Seq Scan on the orders table.
Most rows were filtered out by status and createdAt conditions.
An additional Sort (top-N heapsort) step was required for ORDER BY createdAt DESC.
Execution time was around 10–12 ms with a large number of rows removed by filter.
This approach does not scale well as the table grows.

*Optimization*

A partial index was added to match the query pattern:

```
CREATE INDEX idx_orders_created_createdat_desc
ON orders ("createdAt" DESC)
WHERE status = 'created';
```

After optimization
Execution plan highlights:
PostgreSQL switched to an Index Scan using idx_orders_created_createdat_desc.
Rows are returned already ordered, so no additional sort step is needed.
Significantly fewer pages are read (Buffers: shared hit=50 read=2).
Execution time dropped to approximately 0.33 ms.

## Conclusion

Before optimization, PostgreSQL scanned the entire orders table, filtered out most rows, and performed an extra sort operation.
After introducing a partial index aligned with the WHERE and ORDER BY clauses, the planner was able to use an index scan and avoid sorting altogether.
This reduced query execution time by more than an order of magnitude and significantly improved scalability.
