import mongoose, { InferSchemaType, HydratedDocument } from 'mongoose';

export type SowStatus = 'draft' | 'packing' | 'completed';
export type PackingType = 1 | 2 | 3;

const targetItemSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    targetQty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const sowSchema = new mongoose.Schema(
  {
    sowNumber: { type: String, required: true, trim: true },
    poNumber: { type: String, required: true, trim: true },
    batchNo: { type: String, required: true, trim: true },
    clientCode: { type: String, required: true, trim: true },
    packingType: { type: Number, enum: [1, 2, 3], required: true },
    selectedSKUs: { type: [String], default: [] },
    targetItems: { type: [targetItemSchema], default: [] },
    status: { type: String, enum: ['draft', 'packing', 'completed'], default: 'draft' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    completedAt: { type: Date },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

sowSchema.index({ sowNumber: 1, poNumber: 1 });

export type ISow = InferSchemaType<typeof sowSchema>;
export type SowDocument = HydratedDocument<ISow>;

export const Sow = mongoose.model('Sow', sowSchema);
