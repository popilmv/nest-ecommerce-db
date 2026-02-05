import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpException } from '../errors/http-exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = req.url;

    if (exception instanceof HttpException) {
      return res.status(exception.statusCode).json({
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        details: exception.details,
        path,
        timestamp,
      });
    }

    // unexpected
    return res.status(500).json({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected error',
      path,
      timestamp,
    });
  }
}

