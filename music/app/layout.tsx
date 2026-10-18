import type { Metadata } from "next";
import "./globals.css";
import "./legacy-2020.css";
import "./archive-2020.css";
import "./moderation.css";
import "./experience.css";

export const metadata: Metadata = {
  title: "Sprout Music — Where your sound grows",
  description: "Upload your music. Find your next favourite artist. A home for independent sound.",
  icons: {
    icon: "/brand/sprout-logo.png",
    shortcut: "/brand/sprout-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
