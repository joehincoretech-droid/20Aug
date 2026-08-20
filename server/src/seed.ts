import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDb } from './config/db.js';
import { User } from './models/User.js';
import { Product } from './models/Product.js';
import { ProductNameOption } from './models/ProductNameOption.js';
import { PoClient } from './models/PoClient.js';
import { PurchaseOrder } from './models/PurchaseOrder.js';

const INITIAL_SKU_NAMES = [
  { sku: 'SKU-A100', name: '雙黃白蓮蓉' },
  { sku: 'SKU-B200', name: '奶黃' },
  { sku: 'SKU-C300', name: '五仁' },
  { sku: 'SKU-D400', name: '白蓮蓉' },
  { sku: 'SKU-E500', name: '蓮蓉' },
];

const SAMPLE_POS = [
  {
    poNumber: 'PO-1001',
    clientCode: 'CLIENT-HK01',
    items: [
      { sku: 'SKU-B200', productName: '奶黃', qty: 10 },
      { sku: 'SKU-A100', productName: '雙黃白蓮蓉', qty: 20 },
    ],
  },
  {
    poNumber: 'PO-1002',
    clientCode: 'CLIENT-SZ02',
    items: [{ sku: 'SKU-C300', productName: '五仁', qty: 15 }],
  },
  {
    poNumber: 'PO-1003',
    clientCode: 'CLIENT-TW03',
    items: [
      { sku: 'SKU-D400', productName: '白蓮蓉', qty: 8 },
      { sku: 'SKU-E500', productName: '蓮蓉', qty: 12 },
    ],
  },
];

async function run(): Promise<void> {
  await connectDb(process.env.MONGODB_URI);

  const password = await bcrypt.hash('admin123', 10);
  const workerPassword = await bcrypt.hash('worker123', 10);
  const poPassword = await bcrypt.hash('poclerk123', 10);

  await User.findOneAndUpdate(
    { username: 'admin' },
    { username: 'admin', password, role: 'admin' },
    { upsert: true }
  );
  await User.findOneAndUpdate(
    { username: 'worker' },
    { username: 'worker', password: workerPassword, role: 'worker' },
    { upsert: true }
  );
  await User.findOneAndUpdate(
    { username: 'poclerk' },
    { username: 'poclerk', password: poPassword, role: 'po' },
    { upsert: true }
  );

  await ProductNameOption.deleteMany({ $or: [{ sku: { $exists: false } }, { sku: null }, { sku: '' }] });

  for (let i = 0; i < INITIAL_SKU_NAMES.length; i += 1) {
    const item = INITIAL_SKU_NAMES[i];
    await ProductNameOption.findOneAndUpdate(
      { sku: item.sku },
      { sku: item.sku, name: item.name, sortOrder: i },
      { upsert: true }
    );
  }

  for (const po of SAMPLE_POS) {
    await PoClient.findOneAndUpdate(
      { poNumber: po.poNumber },
      { poNumber: po.poNumber, clientCode: po.clientCode },
      { upsert: true }
    );
    await PurchaseOrder.findOneAndUpdate(
      { poNumber: po.poNumber },
      {
        poNumber: po.poNumber,
        clientCode: po.clientCode,
        items: po.items,
      },
      { upsert: true }
    );
  }

  let seq = 1;
  for (const item of INITIAL_SKU_NAMES) {
    for (let i = 1; i <= 12; i += 1) {
      const productId = `P${String(seq).padStart(6, '0')}`;
      await Product.findOneAndUpdate(
        { productId },
        {
          productId,
          sku: item.sku,
          productName: item.name,
        },
        { upsert: true }
      );
      seq += 1;
    }
  }

  console.log('Seed complete.');
  console.log('  Admin    → username: admin     password: admin123');
  console.log('  Worker   → username: worker    password: worker123');
  console.log('  PO clerk → username: poclerk   password: poclerk123');
  console.log('  Sample PO-1001 producted order: 奶黃*10，雙黃白蓮蓉*20');
  process.exit(0);
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
