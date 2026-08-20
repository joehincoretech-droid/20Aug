import mongoose, { InferSchemaType, HydratedDocument } from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, unique: true, trim: true },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

productSchema.index({ sku: 1 });

export type IProduct = InferSchemaType<typeof productSchema>;
export type ProductDocument = HydratedDocument<IProduct>;

export const Product = mongoose.model('Product', productSchema);
