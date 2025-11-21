"use client"

import { useEffect } from "react"

export function CookieCleaner() {
  useEffect(() => {
    // Nettoyer les cookies corrompus au chargement
    const cookies = document.cookie.split(';')
    let hasCorruptedCookie = false
    
    for (let cookie of cookies) {
      const name = cookie.split('=')[0].trim()
      if (name.startsWith('sb-') && name.includes('auth-token')) {
        // Vérifier si le cookie existe mais est vide ou invalide
        const value = cookie.split('=')[1]
        if (!value || value.length < 10) {
          hasCorruptedCookie = true
          break
        }
      }
    }
    
    if (hasCorruptedCookie) {
      console.warn('🧹 Nettoyage des cookies Supabase corrompus...')
      const cookies = document.cookie.split(';')
      for (let cookie of cookies) {
        const name = cookie.split('=')[0].trim()
        if (name.startsWith('sb-')) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
        }
      }
      // Recharger la page UNE SEULE FOIS après nettoyage
      if (!sessionStorage.getItem('cookies_cleaned')) {
        sessionStorage.setItem('cookies_cleaned', 'true')
        window.location.reload()
      }
    }
  }, [])

  return null
}


