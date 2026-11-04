import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
 title: "Vedoy Collabs – finn skapere og samarbeid",
 description: "Oppdag skapere, finn samarbeidspartnere, publiser prosjekter og ta kontakt med tillatelse."
};
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="no"><body>{children}</body></html>;
}
