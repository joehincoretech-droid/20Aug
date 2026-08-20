import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'worker', 'po'], required: true },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
