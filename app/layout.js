// app/layout.js
import './globals.css';

export const metadata = {
  title: 'PNB Account Form Scraper',
  description: 'Upload PNB account opening forms and extract data to MongoDB & Google Sheets',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
