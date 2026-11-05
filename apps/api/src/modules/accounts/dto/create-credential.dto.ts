import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export const credentialTypes = [
  'api_key',
  'api_secret',
  'access_token',
  'refresh_token',
  'totp_secret',
] as const;

export class CreateCredentialDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  providerId!: string;

  @ApiProperty({ enum: [...credentialTypes] })
  @IsIn(credentialTypes)
  credentialType!: (typeof credentialTypes)[number];

  @ApiProperty({
    minLength: 1,
    format: 'password',
    description: 'Plaintext value; encrypted before persistence.',
  })
  @IsString()
  @MinLength(1)
  value!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
