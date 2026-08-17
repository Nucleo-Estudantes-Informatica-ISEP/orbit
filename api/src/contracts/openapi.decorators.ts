import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from './response.dto';

export function ApiProtectedController() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiBadRequestResponse({ type: ErrorResponseDto }),
    ApiUnauthorizedResponse({ type: ErrorResponseDto }),
    ApiForbiddenResponse({ type: ErrorResponseDto }),
    ApiNotFoundResponse({ type: ErrorResponseDto }),
    ApiConflictResponse({ type: ErrorResponseDto }),
  );
}

export function ApiValidatedOperation() {
  return applyDecorators(
    ApiBadRequestResponse({ type: ErrorResponseDto }),
    ApiNotFoundResponse({ type: ErrorResponseDto }),
    ApiConflictResponse({ type: ErrorResponseDto }),
  );
}

export function ApiEntity(type: Type<unknown>) {
  return ApiOkResponse({ type });
}

export function ApiEntityList(type: Type<unknown>) {
  return ApiOkResponse({ type, isArray: true });
}
