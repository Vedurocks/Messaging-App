import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Secure Comms',
  description: 'End-to-end conversation platform.',
  icons: {
    icon: 'https://github.com/Vedurocks/Messaging-App/blob/main/public/image-Photoroom.png?raw=true',
  },
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

        <footer className="fixed bottom-0 left-0 z-50 flex h-6 w-full items-center justify-center border-t border-border bg-background-elevated/90 backdrop-blur-sm">
          <a
            href="https://github.com/Vedurocks/Messaging-App/tree/main#"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-content-secondary transition hover:text-content-primary"
          >
            Vedurocks 2026 ™©
          </a>
        </footer>
      </body>
    </html>
  );
}
