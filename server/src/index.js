import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDb } from './config/db.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { sowsRouter } from './routes/sows.js';
import { packingRouter } from './routes/packing.js';
import { productsRouter } from './routes/products.js';
import { productNamesRouter } from './routes/productNames.js';
import { purchaseOrdersRouter } from './routes/purchaseOrders.js';
import { poClientsRouter } from './routes/poClients.js';
import { logsRouter } from './routes/logs.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/sows', sowsRouter);
app.use('/api/packing', packingRouter);
app.use('/api/products', productsRouter);
app.use('/api/product-names', productNamesRouter);
app.use('/api/purchase-orders', purchaseOrdersRouter);
app.use('/api/po-clients', poClientsRouter);
app.use('/api/logs', logsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

const port = Number(process.env.PORT) || 5001;

connectDb(process.env.MONGODB_URI)
  .then(() => {
    app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
