import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto.js';

/**
 * Documents the two session transports accepted by SessionAuthGuard: an
 * `Authorization: Bearer <token>` header or the httpOnly session cookie.
 */
export function ApiSessionAuth(): ClassDecorator & MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiCookieAuth(),
    ApiUnauthorizedResponse({
      type: ErrorResponseDto,
      description: 'Missing, invalid or expired session',
    }),
  );
}
