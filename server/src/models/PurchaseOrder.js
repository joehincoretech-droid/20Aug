import mongoose from 'mongoose';

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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
