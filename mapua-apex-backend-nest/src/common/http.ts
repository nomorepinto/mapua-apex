import { HttpException } from '@nestjs/common';

/** Throw a Laravel-shaped `{ message }` error and stop the handler. */
export function abort(status: number, message = ''): never {
  const body =
    message === ''
      ? { message: status === 404 ? 'Not Found' : 'Error' }
      : { message };
  throw new HttpException(body, status);
}
