import "example-ui/layout.css";
import "example/overlay";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Example — Vinext",
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
