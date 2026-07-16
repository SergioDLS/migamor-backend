import {
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @IsPositive()
  quantity: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
