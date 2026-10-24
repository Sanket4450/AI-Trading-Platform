import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateStrategyVersionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  codeRef!: string;

  @IsObject()
  parameterSchema!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  changelog?: string;
}
