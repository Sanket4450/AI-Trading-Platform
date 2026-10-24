import { IsDefined, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  @IsDefined()
  value!: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
