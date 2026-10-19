import type { Metadata } from "next";
import "./globals.css";
import "./legacy-2020.css";
import "./archive-2020.css";
import "./moderation.css";
import "./experience.css";
import "./player.css";

export const metadata: Metadata = {
  verification: {
    google: "M4EGnx70c4Twp-8gfZXyE8nOo0FQfWkDDBV0hcmaAhg",
  },
  title: "Sprout — Videos, with privacy in mind",
  description: "A privacy-focused home for video, with no app analytics, local assets and watch history off by default.",
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
