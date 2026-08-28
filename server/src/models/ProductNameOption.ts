import mongoose, { InferSchemaType, HydratedDocument } from 'mongoose';

const productNameOptionSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, unique: true, trim: true },
    boxesPerOuterBox: { type: Number, required: true, min: 1 },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type IProductNameOption = InferSchemaType<typeof productNameOptionSchema>;
export type ProductNameOptionDocument = HydratedDocument<IProductNameOption>;

export const ProductNameOption = mongoose.model('ProductNameOption', productNameOptionSchema);
