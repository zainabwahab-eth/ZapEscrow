import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class DealItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsNumber()
  @Min(1)
  quantity: number;
}

/**
 * This is what gets submitted once the seller taps "Confirm & create link"
 * (Telegram) or "Create link" (dashboard) — i.e. AFTER the review step.
 * Nothing before this point touches the database (see project notes on
 * keeping drafts ephemeral in Redis/session state).
 */
export class CreateDealDto {
  @IsString()
  sellerId: string;

  @IsOptional()
  @IsString()
  buyerName?: string;

  @IsString()
  buyerPhone: string;

  @IsOptional()
  @IsEmail()
  buyerEmail?: string;

  @IsOptional()
  @IsString()
  buyerTelegramId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DealItemDto)
  items: DealItemDto[];
}
