import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileRecord } from './entities/file-record.entity';
import { S3Service } from './storage/s3.service';
import { Product } from '../products/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FileRecord, Product])],
  controllers: [FilesController],
  providers: [FilesService, S3Service],
  exports: [FilesService],
})
export class FilesModule {}
