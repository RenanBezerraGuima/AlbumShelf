import React from "react"
import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeHandler } from '@/components/theme-handler'
import { Toaster } from 'sonner'
import {
  Syne,
  Fraunces,
  Bricolage_Grotesque,
  Cormorant_Garamond,
  JetBrains_Mono,
  Hanken_Grotesk
} from 'next/font/google'
import './globals.css'

const syne = Syne({ subsets: ['latin'], variable: '--font-syne' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces' })
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-cormorant' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })
const hanken = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-hanken' })

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
    <html lang="en" suppressHydrationWarning>
      <body className={`
        ${syne.variable}
        ${fraunces.variable}
        ${bricolage.variable}
        ${cormorant.variable}
        ${jetbrains.variable}
        ${hanken.variable}
        antialiased
      `}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ThemeHandler />
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
