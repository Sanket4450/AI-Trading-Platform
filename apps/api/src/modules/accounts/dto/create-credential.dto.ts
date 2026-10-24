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
  @IsUUID()
  providerId!: string;

  @IsIn(credentialTypes)
  credentialType!: (typeof credentialTypes)[number];

  @IsString()
  @MinLength(1)
  value!: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
