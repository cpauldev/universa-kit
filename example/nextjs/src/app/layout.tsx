import "@example/shared/layout.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Universal Bridge — Next.js",
  icons: {
    icon: "/favicon.svg",
  },
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
