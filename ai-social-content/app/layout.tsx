import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Social Content Generator",
  description:
    "Generate images, videos, and voiceovers for social media using AI — powered by VideoGen.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
