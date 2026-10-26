import "./globals.css";
import localFont from "next/font/local";
import AppShell from "./AppShell";

// Self-hosted from app/lib/fonts rather than fetched from Google at build time,
// so a build never depends on the network. The PNG exports load the same files,
// which is what makes Lark posts match the screen.
const inter = localFont({
  src: [
    { path: "./lib/fonts/Inter-Regular.woff", weight: "400", style: "normal" },
    { path: "./lib/fonts/Inter-SemiBold.woff", weight: "600", style: "normal" },
    { path: "./lib/fonts/Inter-Bold.woff", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "SDC Engine",
  description: "SIIDigitalCreative team workspace — dashboard, calendar, tasks, and team.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
