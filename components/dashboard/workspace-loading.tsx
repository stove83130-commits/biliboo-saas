"use client"

import { useState, useEffect } from "react"

export function WorkspaceLoadingOverlay() {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Simuler un chargement initial
    setIsLoading(true)
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

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


