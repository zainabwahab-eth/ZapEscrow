import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  // Used by the dashboard's new-deal form to attach item photos — sellers only.
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('No file provided');

    const extension = file.originalname.includes('.') ? file.originalname.split('.').pop() : 'jpg';
    const path = `deal-items/${req.sellerId}-${Date.now()}.${extension}`;
    const url = await this.storageService.uploadBuffer(file.buffer, path, file.mimetype);
    return { url };
  }
}
