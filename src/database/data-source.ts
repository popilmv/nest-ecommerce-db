import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';

import { User } from '../modules/users/user.entity';
import { Product } from '../modules/products/product.entity';
import { Order } from '../modules/orders/order.entity';
import { OrderItem } from '../modules/orders/order-item.entity';
import { FileRecord } from '../modules/files/entities/file-record.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false,
  entities: [User, Product, Order, OrderItem, FileRecord],
  migrations: [path.join(__dirname, '..', 'migrations', '*.{ts,js}')],
});
