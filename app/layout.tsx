import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JPEG Image Compressor & Resizer",
  description: "Instantly resize and compress photos! Decrease photo size without losing quality. Supports JPG, PNG, HEIC, WEBP, PDF formats.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
