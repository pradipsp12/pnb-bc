// lib/models/Transaction.js
import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema(
  {
    customerId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Customer',
      required: [true, 'Customer ID is required'],
      index:    true,
    },
    type: {
      type:     String,
      enum:     ['given', 'received'],
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type:     Number,
      required: [true, 'Amount is required'],
      min:      [0.01, 'Amount must be greater than 0'],
    },
    note: {
      type:    String,
      trim:    true,
      default: '',
    },
  },
  {
    timestamps: true,   // createdAt = auto timestamp shown in the bubble
    collection: 'transactions',
  }
);

TransactionSchema.index({ customerId: 1, createdAt: 1 });

export default mongoose.models.Transaction ||
  mongoose.model('Transaction', TransactionSchema);