import "demo/overlay";
import "example-ui/styles.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo — Next.js",
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
