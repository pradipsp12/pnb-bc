// app/layout.js
import './globals.css';

export const metadata = {
  title: 'PNB-BC CRM',
  description: 'A CRM system for PNB-BC',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
