import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: SupabaseClient | null;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL', '');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', '');
    this.client = url && serviceRoleKey ? createClient(url, serviceRoleKey) : null;
    this.bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET', 'escrow-images');

    if (!this.client) {
      this.logger.warn('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — image uploads are disabled');
    }
  }

  /** Downloads a file from a URL (e.g. a Telegram file link) and uploads it to Supabase Storage, returning its public URL. */
  async uploadFromUrl(sourceUrl: string, path: string): Promise<string> {
    if (!this.client) {
      throw new Error('Image storage is not configured (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing)');
    }

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file from ${sourceUrl}: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? 'image/jpeg';

    const { error } = await this.client.storage.from(this.bucket).upload(path, buffer, {
      contentType,
      upsert: true,
    });
    if (error) {
      this.logger.error(`Supabase upload failed for ${path}: ${error.message}`);
      throw new Error(error.message);
    }

    const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);
    return data.publicUrl;
  }
}
