import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Vedoy Collabs | Finn skapere og samarbeid", description: "Oppdag kreative talenter, bygg samarbeid og kontakt skapere trygt." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="no"><body>{children}</body></html>;
}
