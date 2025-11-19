"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"
import { usePathname } from "next/navigation"

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Retour au tableau de bord</span>
            </Link>
          </div>
          <Link href="/" className="flex items-center gap-2">
            <Image 
              src="/logos/logo%20off.png" 
              alt="Bilibou Logo" 
              width={32} 
              height={32}
              className="h-8 w-auto"
            />
            <span className="text-sm font-semibold text-foreground">Bilibou</span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border bg-background">
          <div className="p-6">
            <nav className="space-y-2">
              <Link 
                href="/settings/personal" 
                className={`block rounded-lg px-3 py-2 text-sm ${
                  pathname === '/settings/personal' 
                    ? 'bg-primary/10 font-medium text-primary' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Paramètres personnels
              </Link>
              <Link 
                href="/settings/organizations" 
                className={`block rounded-lg px-3 py-2 text-sm ${
                  pathname?.startsWith('/settings/organizations')
                    ? 'bg-primary/10 font-medium text-primary' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Organisations
              </Link>
              <a 
                href="mailto:contact@bilibou.com" 
                className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Aide
              </a>
              <Link 
                href="/settings/billing" 
                className={`block rounded-lg px-3 py-2 text-sm ${
                  pathname === '/settings/billing' 
                    ? 'bg-primary/10 font-medium text-primary' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Facturation
              </Link>
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 p-6">
          {children}
        </div>
      </main>
    </div>
  )
}




