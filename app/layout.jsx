import "./globals.css";

export const metadata = {
  title: "SDC Engine",
  description: "SIIDigitalCreative team workspace — dashboard, calendar, tasks, and team.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
