import './globals.css';

export const metadata = {
  title: 'Priority Tasks',
  description: 'MedStar Facilities Command Console',
  manifest: '/manifest.json',
  themeColor: '#c39248',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Priority Tasks',
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
