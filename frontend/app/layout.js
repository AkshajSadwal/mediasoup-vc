import "./globals.css";
import AuthProvider from "@/components/auth/AuthProvider";

export const metadata = {
  title: "Rauma",
  description: "Video meetings with scheduled rooms",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
