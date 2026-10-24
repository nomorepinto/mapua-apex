declare module '@codegenie/serverless-express' {
  import type { Express } from 'express';

  type LambdaHandler = (event: unknown, context: unknown) => Promise<unknown>;

  function serverlessExpress(options: { app: Express }): LambdaHandler;
  export default serverlessExpress;
}
