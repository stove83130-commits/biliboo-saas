import type { Metadata } from 'next'
import './globals.css'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Bilibou',
  description: 'Gestion de factures',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground" suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
