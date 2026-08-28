import 'dotenv/config';
import { connectDb } from '../config/db.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';

async function run(): Promise<void> {
  await connectDb(process.env.MONGODB_URI);
  const delivery = new Date('2026-12-31');
  const result = await PurchaseOrder.updateMany(
    {},
    { $set: { estimatedDeliveryDate: delivery } }
  );
  console.log(`Set estimated delivery to 31/12/2026 on ${result.modifiedCount} of ${result.matchedCount} PO(s).`);
  process.exit(0);
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
