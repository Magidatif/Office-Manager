import app from '../../worker/index';

// Cloudflare Pages Functions adapter for Hono API
export const onRequest: PagesFunction<any> = async (context) => {
  return app.fetch(context.request, context.env, context);
};
