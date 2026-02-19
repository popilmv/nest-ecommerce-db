import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FilesService } from './files.service';
import { PresignFileDto } from './dto/presign-file.dto';
import { CompleteFileDto } from './dto/complete-file.dto';
import { DevAuthGuard } from '../../common/auth/dev-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { RequestUser } from '../../common/auth/user.types';

@Controller('files')
@UseGuards(DevAuthGuard) // replace with real JWT AuthGuard in prod
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('presign')
  presign(@CurrentUser() user: RequestUser, @Body() dto: PresignFileDto) {
    return this.files.presignUpload(user, dto);
  }

  @Post('complete')
  complete(@CurrentUser() user: RequestUser, @Body() dto: CompleteFileDto) {
    return this.files.completeUpload(user, dto.fileId);
  }

  @Get(':id')
  getUrl(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.files.getViewUrl(user, id);
  }
}
