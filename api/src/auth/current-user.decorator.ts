import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from './authenticated-request';

export const CurrentUser = createParamDecorator<
  keyof AuthenticatedUser | undefined
>((property, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return property ? request.user[property] : request.user;
});
