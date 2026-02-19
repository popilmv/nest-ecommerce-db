import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { FileRecord } from './entities/file-record.entity';
import { FileStatus } from './types/file-status.enum';
import { FileVisibility } from './types/file-visibility.enum';
import { S3Service } from './storage/s3.service';
import { Product } from '../products/product.entity';
import type { RequestUser } from '../../common/auth/user.types';
import type { PresignFileDto } from './dto/presign-file.dto';

@Injectable()
export class FilesService {
  private readonly bucket: string;
  private readonly presignExpiresSec: number;
  private readonly cloudfrontBaseUrl?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly s3: S3Service,
    @InjectRepository(FileRecord) private readonly filesRepo: Repository<FileRecord>,
    @InjectRepository(Product) private readonly productsRepo: Repository<Product>,
  ) {
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    this.presignExpiresSec = Number(this.config.get<string>('FILES_PRESIGN_EXPIRES_SEC') ?? '120');
    this.cloudfrontBaseUrl = this.config.get<string>('CLOUDFRONT_BASE_URL') ?? undefined;
  }

  /**
   * Generates canonical object key.
   * NOTE: client must NOT send key.
   */
  private buildKey(args: { entityType: 'product' | 'user'; entityId: string; contentType: string }): string {
    const ext = this.extFromContentType(args.contentType);
    const id = uuidv4();

    if (args.entityType === 'product') {
      return `products/${args.entityId}/images/${id}.${ext}`;
    }

    return `users/${args.entityId}/avatars/${id}.${ext}`;
  }

  private extFromContentType(contentType: string): string {
    switch (contentType) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        throw new BadRequestException('Unsupported contentType');
    }
  }

  async presignUpload(user: RequestUser, dto: PresignFileDto) {
    // minimal RBAC example: only admin can upload product images
    if (dto.entityType === 'product' && user.role !== 'admin') {
      throw new ForbiddenException('Only admin can upload product images');
    }

    // You can also verify entity existence
    if (dto.entityType === 'product') {
      const exists = await this.productsRepo.exist({ where: { id: dto.entityId } });
      if (!exists) throw new NotFoundException('Product not found');
    }

    const key = this.buildKey({ entityType: dto.entityType, entityId: dto.entityId, contentType: dto.contentType });

    const file = this.filesRepo.create({
      ownerId: user.id,
      entityType: dto.entityType,
      entityId: dto.entityId,
      key,
      bucket: this.bucket,
      contentType: dto.contentType,
      size: dto.size,
      visibility: dto.visibility ?? FileVisibility.Private,
      status: FileStatus.Pending,
    });

    const saved = await this.filesRepo.save(file);

    const uploadUrl = await this.s3.createPresignedPutUrl({
      bucket: this.bucket,
      key,
      contentType: dto.contentType,
      expiresInSec: this.presignExpiresSec,
    });

    return {
      fileId: saved.id,
      key: saved.key,
      uploadUrl,
      contentType: saved.contentType,
    };
  }

  async completeUpload(user: RequestUser, fileId: string) {
    const file = await this.filesRepo.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');

    if (file.ownerId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('You cannot complete чужий файл');
    }

    if (file.status !== FileStatus.Pending) {
      throw new BadRequestException('File is not in pending status');
    }

    file.status = FileStatus.Ready;
    await this.filesRepo.save(file);

    // bind to domain entity
    if (file.entityType === 'product') {
      // If you prefer, enforce admin here too
      await this.productsRepo.update({ id: file.entityId }, { imageFileId: file.id });
    }

    return { ok: true };
  }

  buildPublicUrl(key: string): string {
    if (this.cloudfrontBaseUrl) {
      return `${this.cloudfrontBaseUrl.replace(/\/$/, '')}/${key}`;
    }
    // dev fallback (works only if your bucket/object is readable or you use presigned GET)
    return `https://${this.bucket}.s3.${this.config.getOrThrow<string>('AWS_REGION')}.amazonaws.com/${key}`;
  }

  async getViewUrl(user: RequestUser, fileId: string) {
    const file = await this.filesRepo.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');

    const isOwner = file.ownerId === user.id;
    const canRead =
      file.visibility === FileVisibility.Public ||
      isOwner ||
      user.role === 'admin';

    if (!canRead) throw new ForbiddenException('No access to this file');

    // If public delivery is ok → return CDN/S3 URL.
    // For private visibility in dev → you can return presigned GET instead.
    if (file.visibility === FileVisibility.Public) {
      return { url: this.buildPublicUrl(file.key) };
    }

    const url = await this.s3.createPresignedGetUrl({
      bucket: file.bucket,
      key: file.key,
      expiresInSec: 120,
    });

    return { url };
  }
}
