import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Product } from '../products/product.entity';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors/http-exception';

@Injectable()
export class OrdersService {
  constructor(private readonly dataSource: DataSource) {}

  async createOrder(dto: CreateOrderDto, idempotencyKey: string) {
    if (!idempotencyKey) throw new BadRequestError('Idempotency-Key header is required');

    if (!dto.userId) throw new BadRequestError('userId is required');
    if (!dto.items?.length) throw new BadRequestError('items must be a non-empty array');

    for (const it of dto.items) {
      if (!it.productId) throw new BadRequestError('productId is required', { item: it });
      if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
        throw new BadRequestError('quantity must be positive int', { item: it });
      }
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // 1) idempotency
      const existing = await qr.manager.findOne(Order, {
        where: { userId: dto.userId, idempotencyKey },
        relations: { items: false },
      });

      if (existing) {
        await qr.commitTransaction();
        return { reused: true, order: existing };
      }

      // 2) lock products
      const productIds = dto.items.map((i) => i.productId);

      const products = await qr.manager
        .createQueryBuilder(Product, 'p')
        .where({ id: In(productIds) })
        .setLock('pessimistic_write') // у Postgres це FOR UPDATE
        // якщо хочеш саме FOR NO KEY UPDATE:
        // .setLock('for_no_key_update')
        .getMany();

      if (products.length !== new Set(productIds).size) {
        const found = new Set(products.map((p) => p.id));
        const missing = productIds.filter((id) => !found.has(id));
        throw new NotFoundError('Some products not found', { missing });
      }

      // 3) check stock
      const byId = new Map(products.map((p) => [p.id, p]));
      for (const it of dto.items) {
        const p = byId.get(it.productId)!;
        if (p.stock < it.quantity) {
          throw new ConflictError('Insufficient stock', {
            productId: p.id,
            available: p.stock,
            requested: it.quantity,
          });
        }
      }

      // 4) create order
      const order = qr.manager.create(Order, {
        userId: dto.userId,
        idempotencyKey,
        status: 'created',
      });
      await qr.manager.save(order);

      // 5) create items 
      for (const it of dto.items) {
        const p = byId.get(it.productId)!;

        // without oversell
        p.stock = p.stock - it.quantity;
        await qr.manager.save(p);

        const item = qr.manager.create(OrderItem, {
          orderId: order.id,
          productId: p.id,
          quantity: it.quantity,
          priceAtPurchase: p.price,
        });
        await qr.manager.save(item);
      }

      await qr.commitTransaction();
      return { reused: false, order };
    } catch (e: any) {
      await qr.rollbackTransaction();
      if (e?.code === '23505') {
        const order = await this.dataSource.getRepository(Order).findOne({
          where: { userId: dto.userId, idempotencyKey },
        });
        if (order) return { reused: true, order };
        throw new ConflictError('Duplicate idempotency key');
      }

      throw e;
    } finally {
      await qr.release();
    }
  }
}

