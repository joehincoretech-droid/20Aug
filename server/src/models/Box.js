import mongoose from 'mongoose';

const packedProductSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
  },
  { _id: false }
);

const boxSchema = new mongoose.Schema(
  {
    boxId: { type: String, required: true, unique: true, trim: true },
    palletId: { type: String, default: null },
    sowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sow', required: true },
    products: { type: [packedProductSchema], default: [] },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const BOX_PRODUCT_LIMIT = 30;
export const Box = mongoose.model('Box', boxSchema);
