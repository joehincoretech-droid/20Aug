import express, { type Request, type Response, type NextFunction, type Express } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { sowsRouter } from './routes/sows.js';
import { packingRouter } from './routes/packing.js';
import { productsRouter } from './routes/products.js';
import { productNamesRouter } from './routes/productNames.js';
import { purchaseOrdersRouter } from './routes/purchaseOrders.js';
import { poClientsRouter } from './routes/poClients.js';
import { logsRouter } from './routes/logs.js';
import { dashboardRouter } from './routes/dashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(staticDir?: string): Express {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/sows', sowsRouter);
  app.use('/api/packing', packingRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/product-names', productNamesRouter);
  app.use('/api/purchase-orders', purchaseOrdersRouter);
  app.use('/api/po-clients', poClientsRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/dashboard', dashboardRouter);

  const clientDist =
    staticDir ||
    process.env.CLIENT_DIST ||
    path.resolve(__dirname, '../../client/dist');

  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(clientDist, 'index.html'), (err) => {
        if (err) next(err);
      });
    });
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  });

  return app;
}
