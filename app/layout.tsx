import type { Metadata, Viewport } from 'next';
import { Caveat, Figtree } from 'next/font/google';
import './globals.css';

const figtree = Figtree({
  variable: '--font-figtree',
  subsets: ['latin'],
  weight: ['400', '600', '800', '900'],
  style: ['normal', 'italic'],
});

// The handwriting accent: one short note per screen, never a control.
const caveat = Caveat({
  variable: '--font-hand',
  subsets: ['latin'],
  weight: ['700'],
});

export const metadata: Metadata = {
  title: 'Into the Moment',
  description: 'Put yourself into any photo moment: your face, age and build, in their pose and place.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#f1edf8',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${figtree.variable} ${caveat.variable}`}>
      <body>
        {/* The aurora: three soft clouds drift behind every screen. Pure CSS, still with reduced motion. */}
        <div className="aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        {children}
      </body>
    </html>
  );
}
