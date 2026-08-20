import mongoose from 'mongoose';

const productNameOptionSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, unique: true, trim: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const ProductNameOption = mongoose.model('ProductNameOption', productNameOptionSchema);
