import {
  HttpStatus,
  UnprocessableEntityException,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';

/**
 * Flatten class-validator trees into Laravel's dotted `errors` bag.
 * Unknown fields are stripped (`whitelist`) and not rejected, matching Laravel.
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): Record<string, string[]> {
  const bag: Record<string, string[]> = {};
  for (const error of errors) {
    const path = parent === '' ? error.property : `${parent}.${error.property}`;
    if (error.constraints) {
      bag[path] = Object.values(error.constraints);
    }
    if (error.children && error.children.length > 0) {
      const nested = flattenValidationErrors(error.children, path);
      for (const [key, messages] of Object.entries(nested)) {
        bag[key] = messages;
      }
    }
  }
  return bag;
}

export function validationExceptionFactory(
  errors: ValidationError[],
): UnprocessableEntityException {
  const bag = flattenValidationErrors(errors);
  const messages = Object.values(bag).flat();
  const first = messages[0] ?? 'The given data was invalid.';
  const rest = messages.length - 1;
  const suffix =
    rest > 0 ? ` (and ${rest} more error${rest === 1 ? '' : 's'})` : '';
  return new UnprocessableEntityException({
    message: `${first}${suffix}`,
    errors: bag,
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    exceptionFactory: validationExceptionFactory,
  });
}
