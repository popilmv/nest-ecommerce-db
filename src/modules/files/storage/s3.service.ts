import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type PresignPutInput = {
  bucket: string;
  key: string;
  contentType: string;
  expiresInSeconds: number;
};

export type PresignGetInput = {
  bucket: string;
  key: string;
  expiresInSeconds: number;
};

@Injectable()
export class S3Service {
  private readonly client: S3Client;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('AWS_REGION') ?? 'us-east-1';
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const forcePathStyle = this.config.get<string>('S3_FORCE_PATH_STYLE') === 'true';

    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle,
      // credentials беруться з env автоматично через default provider chain
    });
  }

  async createPresignedPutUrl(input: PresignPutInput): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      ContentType: input.contentType,
    });

    return getSignedUrl(this.client, cmd, { expiresIn: input.expiresInSeconds });
  }

  async createPresignedGetUrl(input: PresignGetInput): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
    });

    return getSignedUrl(this.client, cmd, { expiresIn: input.expiresInSeconds });
  }
}