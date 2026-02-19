import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly client: S3Client;

  constructor(private readonly config: ConfigService) {
    this.client = new S3Client({
      region: this.config.getOrThrow<string>('AWS_REGION'),
      // credentials: for dev, SDK will read env AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY automatically.
      // In prod (ECS/EC2/Lambda), prefer IAM role.
    });
  }

  async createPresignedPutUrl(args: {
    bucket: string;
    key: string;
    contentType: string;
    expiresInSec: number;
  }): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: args.bucket,
      Key: args.key,
      ContentType: args.contentType,
      // optional: ContentMD5 can be enforced if you calculate it client-side
    });

    return getSignedUrl(this.client, cmd, { expiresIn: args.expiresInSec });
  }

  async createPresignedGetUrl(args: { bucket: string; key: string; expiresInSec: number }): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: args.bucket,
      Key: args.key,
    });

    return getSignedUrl(this.client, cmd, { expiresIn: args.expiresInSec });
  }
}
