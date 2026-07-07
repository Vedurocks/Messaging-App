import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Secure Comms',
  description: 'End-to-end conversation platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-content-primary font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
