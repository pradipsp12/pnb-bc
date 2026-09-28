# PNB Account Form Scraper

A Next.js application that uploads Punjab National Bank Account Opening Forms (FORM-33), extracts data using PDF parsing, and saves to MongoDB & Google Sheets.

## Features

- 📄 PDF upload with drag & drop
- 🔍 Auto-extracts: Reference No, Customer Name, Address, Account No, Customer ID, Mobile No, Open Date, Photo
- 🗄️ Saves to MongoDB Atlas
- 📊 Appends rows to Google Sheets with proper column headers
- 📋 View all saved records in a table

---

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
GOOGLE_SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
GOOGLE_CLIENT_EMAIL=my-service@my-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
```

### 3. MongoDB Setup

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a free cluster
3. Click **Connect** → **Connect your application**
4. Copy the connection string and paste as `MONGODB_URI`
5. Replace `<password>` with your DB user password

### 4. Google Sheets Setup

#### Step A: Create Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable **Google Sheets API**
4. Go to **IAM & Admin** → **Service Accounts** → **Create Service Account**
5. Download the JSON key file

#### Step B: Set Environment Variables
From the downloaded JSON file:
- `GOOGLE_CLIENT_EMAIL` = the `client_email` field
- `GOOGLE_PRIVATE_KEY` = the `private_key` field (keep the `\n` characters)

#### Step C: Share Your Sheet
1. Open your Google Sheet
2. Click **Share**
3. Add the service account email with **Editor** access
4. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit`

### 5. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Google Sheet Columns (Auto-created)

| Column | Description |
|--------|-------------|
| A | Account Open Date |
| B | Customer Name |
| C | Address |
| D | Account No |
| E | Customer ID |
| F | Mobile No |
| G | Reference No |
| H | Photo (note) |
| I | Added At (timestamp) |

---

## Project Structure

```
pdf-scraper/
├── app/
│   ├── api/
│   │   ├── upload/route.js      # PDF upload endpoint
│   │   └── records/route.js     # Fetch saved records
│   ├── page.js                  # Main UI
│   ├── layout.js
│   └── globals.css
├── lib/
│   ├── mongodb.js               # DB connection
│   ├── models/Account.js        # Mongoose schema
│   ├── pdfParser.js             # Text extraction logic
│   └── googleSheets.js          # Sheets API integration
├── .env.local.example
└── README.md
```

---

## Notes

- The app uses `pdf-parse` for text extraction. It works well for text-based PDFs.
- Photo extraction from PDF binary images requires additional tooling (e.g., `pdfimages`). The photo field is noted in the sheet but the raw binary is stored in MongoDB if extractable.
- For scanned PDFs (images), you'd need OCR (like Tesseract). Contact for an extended version.
