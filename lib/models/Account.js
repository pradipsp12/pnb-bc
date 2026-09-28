// lib/models/Account.js
import mongoose from 'mongoose';

const AccountSchema = new mongoose.Schema(
  {
    referenceNo:     { type: String, trim: true },
    accountOpenDate: { type: String, trim: true }, // today's date at upload time
    customerName:    { type: String, trim: true },
    sex:             { type: String, trim: true },
    address:         { type: String, trim: true },
    accountNo:       { type: String, trim: true },
    customerId:      { type: String, trim: true },
    aadhaarNo:       { type: String, trim: true },
    mobileNo:        { type: String, trim: true },
    dateOfBirth:     { type: String, trim: true },
    photoUrl:        { type: String, trim: true }, // ImgBB URL of manually uploaded photo
    scheme:          { type: String, trim: true, enum: ['', 'PMSBY', 'PMJJBY'], default: '' },
    apy:             { type: Boolean, default: false },
    pdfDriveUrl:     { type: String, trim: true }, // Google Drive URL of uploaded PDF
    rawText:         { type: String },
    unfreezeStatus:  { type: Boolean, default: false }, // Account unfreeze toggle
    passbookIssued:  { type: Boolean, default: false }, // Passbook issued toggle
    signUrl:         { type: String, trim: true },      // Google Drive URL of uploaded signature
    signDriveFileId: { type: String, trim: true },      // Drive file ID for sign
  },
  { timestamps: true }
);

export default mongoose.models.Account || mongoose.model('Account', AccountSchema);
