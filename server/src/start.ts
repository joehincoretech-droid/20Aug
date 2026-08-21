import type { Server } from 'http';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';

export interface StartOptions {
  port?: number;
  mongodbUri?: string;
  staticDir?: string;
  host?: string;
}

export async function startServer(options: StartOptions = {}): Promise<{
  server: Server;
  port: number;
}> {
  const uri = options.mongodbUri || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Configure MongoDB Atlas in your .env file.');
  }
  const port = options.port ?? (Number(process.env.PORT) || 5001);
  const host = options.host || '127.0.0.1';
  await connectDb(uri);
  const app = createApp(options.staticDir);
  const server = await new Promise<Server>((resolve, reject) => {
    const s = app.listen(port, host, () => resolve(s));
    s.on('error', reject);
  });
  console.log(`API listening on http://${host}:${port}`);
  return { server, port };
}
