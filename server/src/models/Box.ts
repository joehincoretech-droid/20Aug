import mongoose, { InferSchemaType, HydratedDocument } from 'mongoose';

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

export type IBox = InferSchemaType<typeof boxSchema>;
export type BoxDocument = HydratedDocument<IBox>;
export type PackedProduct = InferSchemaType<typeof packedProductSchema>;

export const BOX_PRODUCT_LIMIT = 30;
export const Box = mongoose.model('Box', boxSchema);
