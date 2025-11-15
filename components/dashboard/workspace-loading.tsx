"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"

export function WorkspaceLoadingOverlay() {
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    // Ne pas afficher le loader sur la page d'accueil ou les pages publiques
    const publicPages = ['/', '/auth/login', '/auth/signup', '/auth/connexion', '/plans', '/contact']
    if (publicPages.includes(pathname || '')) {
      return
    }

    // Simuler un chargement initial uniquement sur les pages du dashboard
    setIsLoading(true)
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 500) // Réduit à 500ms pour un chargement plus rapide

    return () => clearTimeout(timer)
  }, [pathname])

  if (!isLoading) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement de Bilibou...</p>
      </div>
    </div>
  )
}


