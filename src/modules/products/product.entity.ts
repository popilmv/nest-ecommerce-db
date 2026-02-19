import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price: string;

  @Column({ type: 'int' })
  stock: number;

  // FileRecord.id (nullable) - points to uploaded product image
  @Column({ type: 'uuid', nullable: true })
  imageFileId?: string | null;
}

