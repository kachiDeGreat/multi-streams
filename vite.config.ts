import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    server: {
      proxy: {
        '/relay-stat': {
          target: `http://${env.VITE_RELAY_HOST || '16.170.180.150'}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/relay-stat/, '/stat'),
        },
        '/relay-hls': {
          target: `http://${env.VITE_RELAY_HOST || '16.170.180.150'}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/relay-hls/, '/hls'),
        },
      },
    },
    plugins: [
      react(),
      {
        name: 'local-api-handler',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/api/sync-router' && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', (chunk) => {
                bodyStr += chunk;
              });
              req.on('end', async () => {
                try {
                  const body = JSON.parse(bodyStr || '{}');
                  const mod = await server.ssrLoadModule('./api/sync-router.ts');
                  const handler = mod.default;

                  const customRes = {
                    status(code: number) {
                      res.statusCode = code;
                      return this;
                    },
                    json(data: unknown) {
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify(data));
                      return this;
                    },
                  };

                  const customReq = Object.assign(req, { body });
                  await handler(customReq, customRes);
                } catch (err: unknown) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  const message = err instanceof Error ? err.message : String(err);
                  res.end(JSON.stringify({ success: false, error: message }));
                }
              });
              return;
            }
            next();
          });
        },
      },
    ],
  };
});
