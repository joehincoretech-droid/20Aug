import { Router } from 'express';
import { Product } from '../models/Product.js';
import { authRequired } from '../middleware/auth.js';

export const productsRouter = Router();

productsRouter.use(authRequired);

productsRouter.get('/', async (req, res) => {
  const { sku, q } = req.query;
  const filter = {};
  if (sku) filter.sku = sku;
  if (q) {
    filter.$or = [
      { productId: new RegExp(q, 'i') },
      { productName: new RegExp(q, 'i') },
      { sku: new RegExp(q, 'i') },
    ];
  }
  const products = await Product.find(filter).sort({ sku: 1, productId: 1 }).limit(500);
  res.json({ products });
});

productsRouter.get('/skus', async (_req, res) => {
  const skus = await Product.distinct('sku');
  skus.sort();
  res.json({ skus });
});

productsRouter.get('/by-id/:productId', async (req, res) => {
  const product = await Product.findOne({ productId: req.params.productId });
  if (!product) {
    return res.status(404).json({ message: 'Product not found in catalog' });
  }
  res.json({ product });
});
