import { ApiProperty } from '@nestjs/swagger';

export class SessionUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ enum: ['admin', 'operator', 'viewer'] })
  role!: string;

  @ApiProperty({ format: 'uuid', required: false })
  sessionId?: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description:
      'Opaque session token. Use as `Authorization: Bearer <token>` or let the cookie carry it.',
  })
  token!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ type: SessionUserDto })
  user!: SessionUserDto;
}

export class SessionResponseDto {
  @ApiProperty({ type: SessionUserDto })
  user!: SessionUserDto;
}
