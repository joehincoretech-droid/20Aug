import { Router, type Request, type Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { Product, type IProduct } from '../models/Product.js';
import { authRequired } from '../middleware/auth.js';

export const productsRouter = Router();

productsRouter.use(authRequired);

productsRouter.get('/', async (req: Request, res: Response) => {
  const { sku, q } = req.query;
  const filter: FilterQuery<IProduct> = {};
  if (sku) filter.sku = sku as string;
  if (q) {
    const term = String(q);
    filter.$or = [
      { productId: new RegExp(term, 'i') },
      { productName: new RegExp(term, 'i') },
      { sku: new RegExp(term, 'i') },
    ];
  }
  const products = await Product.find(filter).sort({ sku: 1, productId: 1 }).limit(500);
  res.json({ products });
});

productsRouter.get('/skus', async (_req: Request, res: Response) => {
  const skus = await Product.distinct('sku');
  skus.sort();
  res.json({ skus });
});

productsRouter.get('/by-id/:productId', async (req: Request, res: Response) => {
  const product = await Product.findOne({ productId: req.params.productId });
  if (!product) {
    return res.status(404).json({ message: 'Product not found in catalog' });
  }
  res.json({ product });
});
