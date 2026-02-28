import React from "react"
import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeHandler } from '@/components/theme-handler'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'AlbumShelf',
  description: 'Organize your music albums in collections using a fast, local-first catalog.',
  icons: {
    icon: [
      {
        url: 'icon.svg',
        type: 'image/svg+xml',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistMono.variable}`}
    >
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline' api.deezer.com itunes.apple.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: *.deezer.com *.dzcdn.net *.mzstatic.com *.scdn.co *.spotifycdn.com i.scdn.co; connect-src 'self' api.spotify.com accounts.spotify.com api.deezer.com itunes.apple.com; media-src 'self' blob: *.dzcdn.net; base-uri 'self'; form-action 'self';"
        />
      </head>
      <body className="antialiased">
        <a
          href="#main-content"
          className="fixed -top-16 left-4 z-[9999] px-4 py-2 bg-primary text-primary-foreground focus:top-4 focus:outline-none transition-all duration-200 brutalist-shadow font-medium tracking-tighter"
        >
          Skip to content
        </a>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            <ThemeHandler />
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
