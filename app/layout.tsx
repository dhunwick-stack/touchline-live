import './globals.css';
import type { Metadata } from 'next';
import AppChrome from './AppChrome';

export const metadata: Metadata = {
  title: 'Touchline Live',
  description: 'iPad-first live soccer scoring app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-900">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
