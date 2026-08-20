import mongoose from 'mongoose';

export async function connectDb(uri: string | undefined): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri as string);
  console.log('MongoDB connected');
}
