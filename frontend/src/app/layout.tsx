import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MIRROR // Tactical Emergency Mission Command",
  description: "3D Geospatial Digital Twin & Consequence Simulation Operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-tactical-bg text-tactical-text antialiased h-screen w-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
