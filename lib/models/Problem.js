// lib/models/Problem.js
import mongoose from 'mongoose';

const ProblemSchema = new mongoose.Schema(
  {
    // ── Core identity (mirrors Customer schema field names exactly) ──────────
    customerName: {
      type:     String,
      trim:     true,
      required: [true, 'Customer name is required'],
    },
    accountNo: {
      type:     String,
      trim:     true,
      required: [true, 'Account number is required'],
    },
    adharNo: {                          // matches Customer.adharNo (single 'a')
      type:  String,
      trim:  true,
      match: [/^\d{12}$/, 'Aadhaar must be 12 digits'],
    },
    mobileNo: {
      type:    String,
      trim:    true,
      match:   [/^\d{10}$/, 'Mobile must be 10 digits'],
      default: null,
    },

    // ── Problem-specific fields ──────────────────────────────────────────────
    dateOfBirth: { type: String, trim: true },
    customerId:  { type: String, trim: true },
    remarks:     { type: String, trim: true },
    status:      { type: String, enum: ['pending', 'done'], default: 'pending' },
    feedback:    { type: String, trim: true },
    doneAt:      { type: Date },
  },
  {
    timestamps: true,
    collection: 'problems',
  }
);

// ── Indexes (mirrors Customer pattern) ───────────────────────────────────────
ProblemSchema.index({ customerName: 'text', accountNo: 'text', mobileNo: 'text' });
ProblemSchema.index({ createdAt: -1 });
ProblemSchema.index({ status: 1 });

export default mongoose.models.Problem || mongoose.model('Problem', ProblemSchema);
