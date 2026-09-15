import "./globals.css";
import AppShell from "./AppShell";

export const metadata = {
  title: "SDC Engine",
  description: "SIIDigitalCreative team workspace — dashboard, calendar, tasks, and team.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
