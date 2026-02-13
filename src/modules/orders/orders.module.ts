import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersResolver } from './graphql/orders.resolver';
import { OrderItemResolver } from './graphql/order-item.resolver';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersResolver, OrderItemResolver],
})
export class OrdersModule {}

