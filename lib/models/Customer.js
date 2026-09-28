import mongoose from 'mongoose';

const CustomerSchema = new mongoose.Schema(
  {
    customerName: {
      type:     String,
      required: [true, 'Customer name is required'],
      trim:     true,
    },
    accountNo: {
      type:     String,
      required: [true, 'Account number is required'],
      unique:   true,   // this already creates an index — no schema.index() needed
      trim:     true,
    },
    adharNo: {
      type:     String,
      required: [true, 'Aadhaar number is required'],
      trim:     true,
      match:    [/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'],
    },
    mobileNo: {
      type:    String,
      trim:    true,
      match:   [/^\d{10}$/, 'Mobile number must be exactly 10 digits'],
      default: null,
    },
    scheme: {
      type:    String,
      trim:    true,
      enum:    ['', 'PMSBY', 'PMJJBY'],
      default: '',
    },
    apy: {
      type:    Boolean,
      default: false,
    },
    vip: {
      type:    Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'customers',
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// NOTE: accountNo is NOT listed here because unique:true above already creates
// its index. Adding it again here would cause the duplicate warning.
CustomerSchema.index({ customerName: 'text', accountNo: 'text', mobileNo: 'text' });
CustomerSchema.index({ createdAt: -1 });

export default mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);