import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitFiles1700000000000 implements MigrationInterface {
  name = 'InitFiles1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "file_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerId" uuid NOT NULL,
        "entityType" text NOT NULL,
        "entityId" uuid NOT NULL,
        "key" text NOT NULL,
        "bucket" text NOT NULL,
        "contentType" text NOT NULL,
        "size" integer NOT NULL,
        "checksum" text,
        "visibility" text NOT NULL DEFAULT 'private',
        "status" text NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_file_records_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_file_records_ownerId" ON "file_records" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_file_records_entityType" ON "file_records" ("entityType")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_file_records_entityId" ON "file_records" ("entityId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_file_records_key" ON "file_records" ("key")`);

    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "imageFileId" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "imageFileId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "file_records"`);
  }
}