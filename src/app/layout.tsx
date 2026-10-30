import type { Metadata } from "next";
import "./foundation.css";
import "./app.css";

export const metadata: Metadata = {
  title: "Nijam",
  description: "Say what your project does. Nijam checks every claim against the code.",
};

const FONTS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400..800&family=JetBrains+Mono:wght@400;500&family=Instrument+Serif:ital@1&family=Noto+Sans+Devanagari:wght@400;600&family=Noto+Sans+Telugu:wght@400;600&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-accent="amber">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href={FONTS} rel="stylesheet" />
      </head>
      <body>
        <nav className="nav" aria-label="Main">
          <div className="nav__bar">
            <a className="nav__brand" href="/">
              <span className="mark" aria-hidden="true" />
              Nijam
            </a>
            <div className="nav__links">
              <a href="/#samples">Real reports</a>
              <a href="/how">How it decides</a>
            </div>
            <a className="btn btn-ink btn-sm" href="/#check">
              Check a project
            </a>
          </div>
        </nav>
        {children}
        <footer className="footer">
          <div className="container">
            <span>Nijam means truth in Telugu.</span>
            <span>Built for No Hands: The Wispr Challenge.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
