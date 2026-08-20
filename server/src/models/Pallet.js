import mongoose from 'mongoose';

const palletSchema = new mongoose.Schema(
  {
    palletId: { type: String, required: true, unique: true, trim: true },
    sowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sow', required: true },
    boxes: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const PALLET_BOX_LIMIT = 50;
export const Pallet = mongoose.model('Pallet', palletSchema);
