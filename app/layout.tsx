import type { Metadata } from 'next'
import './globals.css'
import { WorkspaceLoadingOverlay } from '@/components/dashboard/workspace-loading'
import { PlanProvider } from '@/contexts/plan-context'
import { GlobalPlanBanner } from '@/components/global-plan-banner'
import { Inter } from 'next/font/google'

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
          <GlobalPlanBanner />
          <WorkspaceLoadingOverlay />
          {children}
        </PlanProvider>
      </body>
    </html>
  )
}
