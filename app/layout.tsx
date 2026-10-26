import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Scout — Your next opportunity",
  description: "Evidence-led internship discovery and career workspace.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
