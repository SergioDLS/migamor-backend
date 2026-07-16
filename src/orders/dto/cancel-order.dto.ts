import { IsString, MinLength, MaxLength } from 'class-validator';

export class CancelOrderDto {
  @IsString()
  @MinLength(3, { message: 'La observación debe tener al menos 3 caracteres' })
  @MaxLength(500)
  reason: string;
}
