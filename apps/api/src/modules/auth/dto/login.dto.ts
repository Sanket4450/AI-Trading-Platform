import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    format: 'email',
    example: 'operator@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, format: 'password', example: 'change-me-123' })
  @IsString()
  @MinLength(8)
  password!: string;
}
