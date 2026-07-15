import "./globals.css";

export const metadata = {
  title: "Video Meeting",
  description: "Mediasoup video calling app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}