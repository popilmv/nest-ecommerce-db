import { IsIn, IsInt, IsNotEmpty, IsString, IsUUID, Max, Min } from 'class-validator';
import { FileVisibility } from '../types/file-visibility.enum';
import type { FileEntityType } from '../entities/file-record.entity';

export class PresignFileDto {
  @IsIn(['user', 'product'])
  entityType: FileEntityType;

  @IsUUID()
  entityId: string;

  // allowlist for images
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType: string;

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024) // 10 MB
  size: number;

  @IsIn([FileVisibility.Private, FileVisibility.Public])
  visibility: FileVisibility;
}
