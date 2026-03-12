import './globals.css';
import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import AppChrome from './AppChrome';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
});

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
      <body className={`${roboto.className} min-h-screen text-slate-900`}>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}