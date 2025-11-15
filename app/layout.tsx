import type { Metadata } from 'next'
import './globals.css'
import { WorkspaceLoadingOverlay } from '@/components/dashboard/workspace-loading'
import { PlanProvider } from '@/contexts/plan-context'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'

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
    <html lang="fr" className={inter.variable}>
      <body className="min-h-screen bg-background text-foreground">
        <PlanProvider>
          <WorkspaceLoadingOverlay />
          {children}
        </PlanProvider>
        <Toaster position="top-right" richColors />
        <Analytics />
      </body>
    </html>
  )
}
