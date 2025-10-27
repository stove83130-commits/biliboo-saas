"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Bell } from "lucide-react"
import { useRouter } from "next/navigation"

interface DashboardLayoutFullProps {
  children: React.ReactNode
  showBackButton?: boolean
  backHref?: string
}

export function DashboardLayoutFull({ 
  children, 
  showBackButton = true,
  backHref = "/dashboard"
}: DashboardLayoutFullProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const handleWorkspaceSwitch = () => {
      setIsLoading(true)
      setTimeout(() => setIsLoading(false), 3000)
    }

    window.addEventListener('workspace:switching', handleWorkspaceSwitch)
    return () => window.removeEventListener('workspace:switching', handleWorkspaceSwitch)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Changement d'espace de travail</h2>
          <p className="text-gray-600">Veuillez patienter...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar seulement */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="px-4 lg:px-6">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-4">
              {showBackButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(backHref)}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Bell className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal - plein écran */}
      <main className="p-4 lg:p-6">
        <div className="max-w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
