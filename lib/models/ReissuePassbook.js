// lib/models/ReissuePassbook.js
import mongoose from 'mongoose';

const ReissuePassbookSchema = new mongoose.Schema(
  {
    customerName: {
      type:     String,
      required: [true, 'Customer name is required'],
      trim:     true,
    },
    accountNo: {
      type:     String,
      required: [true, 'Account number is required'],
      trim:     true,
      // NOT unique — same account can reissue passbook multiple times
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
  },
  {
    timestamps: true,
    collection: 'reissue_passbooks',
  }
);

ReissuePassbookSchema.index({ accountNo: 1 });
ReissuePassbookSchema.index({ createdAt: -1 });

export default mongoose.models.ReissuePassbook ||
  mongoose.model('ReissuePassbook', ReissuePassbookSchema);