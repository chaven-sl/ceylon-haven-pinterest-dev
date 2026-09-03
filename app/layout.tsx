import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ceylon Haven Pinterest Automation',
  description: 'Phase 2: State Machine & Testing Foundation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
