import mongoose from 'mongoose';

const poClientSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true, trim: true },
    clientCode: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const PoClient = mongoose.model('PoClient', poClientSchema);
