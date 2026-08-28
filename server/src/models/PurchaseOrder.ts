import mongoose, { InferSchemaType, HydratedDocument } from 'mongoose';

const poItemSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true, trim: true },
    clientCode: { type: String, required: true, trim: true },
    items: { type: [poItemSchema], default: [] },
    estimatedDeliveryDate: { type: Date, default: null },
    status: { type: String, enum: ['open', 'fulfilled'], default: 'open' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export type IPoItem = InferSchemaType<typeof poItemSchema>;
export type IPurchaseOrder = InferSchemaType<typeof purchaseOrderSchema>;
export type PurchaseOrderDocument = HydratedDocument<IPurchaseOrder>;

export const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
