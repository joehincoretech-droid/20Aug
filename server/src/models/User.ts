import mongoose, { InferSchemaType, HydratedDocument } from 'mongoose';

export type UserRole = 'admin' | 'worker' | 'po';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'worker', 'po'] as const, required: true },
  },
  { timestamps: true }
);

export type IUser = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<IUser>;

export const User = mongoose.model('User', userSchema);
