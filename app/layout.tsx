import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Deezer Album Organizer',
  description: 'Organize Deezer albums in folders using a fast, local-first catalog.',
  icons: {
    icon: [
      {
        url: 'icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: 'icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: 'icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: 'apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
