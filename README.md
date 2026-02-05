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

