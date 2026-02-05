import { Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { OrderItem } from './order-item.entity';

export type OrderStatus = 'created' | 'paid' | 'cancelled';

@Entity('orders')
@Index(['userId', 'idempotencyKey'], { unique: true })
@Index(['status', 'createdAt']) // 
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (u) => u.orders, { onDelete: 'RESTRICT' })
  user: User;

  @Column({ type: 'text' })
  idempotencyKey: string;

  @Column({ type: 'text', default: 'created' })
  status: OrderStatus;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => OrderItem, (i) => i.order, { cascade: false })
  items: OrderItem[];
}

