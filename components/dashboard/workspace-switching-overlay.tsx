"use client"

import { useState, useEffect } from "react"

export function WorkspaceSwitchingOverlay() {
  const [isSwitching, setIsSwitching] = useState(false)

  useEffect(() => {
    let loadHandler: (() => void) | null = null

    // Vérifier si on vient de changer d'espace (après reload)
    const wasSwitching = sessionStorage.getItem('workspace:switching')
    if (wasSwitching === 'true') {
      setIsSwitching(true)
      // Attendre que la page soit complètement chargée
      loadHandler = () => {
        // Petit délai pour laisser le temps aux composants de se charger
        setTimeout(() => {
          setIsSwitching(false)
          sessionStorage.removeItem('workspace:switching')
        }, 300)
      }
      
      if (document.readyState === 'complete') {
        loadHandler()
      } else if (typeof window !== 'undefined') {
        window.addEventListener('load', loadHandler)
      }
    }

    const handleWorkspaceChange = () => {
      setIsSwitching(true)
    }

    // Écouter l'événement de changement d'espace de travail
    if (typeof window !== 'undefined') {
      window.addEventListener('workspace:changed', handleWorkspaceChange)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('workspace:changed', handleWorkspaceChange)
        if (loadHandler) {
          window.removeEventListener('load', loadHandler)
        }
      }
    }
  }, [])

  if (!isSwitching) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-white/60 backdrop-blur-md z-[9999] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-700 font-medium text-lg">Changement d'espace de travail</p>
      </div>
    </div>
  )
}

