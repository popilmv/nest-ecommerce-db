import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitCoreTables1699999999000 implements MigrationInterface {
  name = 'InitCoreTables1699999999000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" text NOT NULL,
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" text NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "stock" integer NOT NULL,
        CONSTRAINT "PK_products_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "idempotencyKey" text NOT NULL,
        "status" text NOT NULL DEFAULT 'created',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_orders_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_orders_userId_idempotencyKey"
      ON "orders" ("userId", "idempotencyKey")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_status_createdAt"
      ON "orders" ("status", "createdAt")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "priceAtPurchase" numeric(10,2) NOT NULL,
        CONSTRAINT "PK_order_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_items_orderId" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_order_items_productId" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_order_items_orderId"
      ON "order_items" ("orderId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_order_items_productId"
      ON "order_items" ("productId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_order_items_productId"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_order_items_orderId"');
    await queryRunner.query('DROP TABLE IF EXISTS "order_items"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_orders_status_createdAt"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_orders_userId_idempotencyKey"');
    await queryRunner.query('DROP TABLE IF EXISTS "orders"');
    await queryRunner.query('DROP TABLE IF EXISTS "products"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');
  }
}
