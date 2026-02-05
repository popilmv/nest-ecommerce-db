import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from './modules/orders/orders.module';
import { User } from './modules/users/user.entity';
import { Product } from './modules/products/product.entity';
import { Order } from './modules/orders/order.entity';
import { OrderItem } from './modules/orders/order-item.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      entities: [User, Product, Order, OrderItem],
      synchronize: true,
      logging: false,
    }),

    OrdersModule,
  ],
})
export class AppModule {}

