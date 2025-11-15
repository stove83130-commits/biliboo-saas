"use client"

import React, { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export function Header() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const pathname = usePathname()
  const userRef = useRef<User | null>(null) // Ref pour suivre l'état actuel de l'utilisateur

  useEffect(() => {
    let mounted = true
    
    const checkAuth = async () => {
      if (!mounted) return
      
      try {
        // Utiliser uniquement getUser() pour éviter l'avertissement de sécurité
        // getUser() authentifie les données en contactant le serveur Supabase
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (!mounted) return
        
        // Vérifier si l'erreur est user_not_found (utilisateur supprimé)
        const isUserNotFound = userError && (
          (userError as any).code === 'user_not_found' ||
          (userError as any).status === 403 ||
          (userError as any).__isAuthError === true
        )
        
        // Si erreur user_not_found, nettoyer immédiatement
        if (isUserNotFound) {
          console.log('🧹 Header: Erreur user_not_found détectée, nettoyage des cookies')
          setUser(null)
          userRef.current = null
          await supabase.auth.signOut().catch(() => {})
          setIsChecking(false)
          return
        }
        
        // Vérifier que user existe et est valide
        if (userError || !user || !user.email) {
          setUser(null)
          userRef.current = null
          setIsChecking(false)
          return
        }
        
        // Utilisateur valide
        setUser(user)
        userRef.current = user
        
        setIsChecking(false)
      } catch (error) {
        if (mounted) {
          setUser(null)
          userRef.current = null
          setIsChecking(false)
        }
      }
    }
    
    // Vérification initiale
    checkAuth()
    
    // Écouter les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      // Si déconnexion ou pas de session, forcer user à null
      if (event === 'SIGNED_OUT' || !session || !session.user || !session.user.email) {
        setUser(null)
        userRef.current = null
        setIsChecking(false)
        return
      }
      
      // Vérifier avec getUser() pour être sûr (évite l'avertissement de sécurité)
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        // Vérifier si l'erreur est user_not_found (utilisateur supprimé)
        const isUserNotFound = userError && (
          (userError as any).code === 'user_not_found' ||
          (userError as any).status === 403 ||
          (userError as any).__isAuthError === true
        )
        
        if (isUserNotFound || userError || !user || !user.email) {
          setUser(null)
          userRef.current = null
          await supabase.auth.signOut().catch(() => {})
          setIsChecking(false)
          return
        }
        
        // Utilisateur valide
        setUser(user)
        userRef.current = user
      } catch (error) {
        setUser(null)
        userRef.current = null
        setIsChecking(false)
      }
      
      setIsChecking(false)
    })
    
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  const scrollToSection = (sectionId: string) => {
    // Si on est sur la page d'accueil, on scroll directement
    if (pathname === '/') {
      const element = document.getElementById(sectionId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      // Sinon, on redirige vers la page d'accueil avec le hash
      window.location.href = `/#${sectionId}`
    }
  }

  return (
    <header className="w-full pt-4">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <Image 
            src="/logos/logo%20off.png" 
            alt="Bilibou Logo" 
            width={56} 
            height={56}
            className="h-14 w-auto"
          />
          <span className="text-xl font-semibold text-foreground">Bilibou</span>
        </Link>

        {/* Navigation Desktop - Centrée et alignée avec le bouton principal */}
        <nav className="hidden md:flex items-center space-x-6 absolute left-1/2 transform -translate-x-1/2">
          <button 
            onClick={() => scrollToSection('features-section')}
            className="text-foreground hover:text-primary transition-colors font-medium text-base"
          >
            Fonctionnalités
          </button>
          <button 
            onClick={() => scrollToSection('pricing-section')}
            className="text-foreground hover:text-primary transition-colors font-medium text-base"
          >
            Tarifs
          </button>
          <button 
            onClick={() => scrollToSection('faq-section')}
            className="text-foreground hover:text-primary transition-colors font-medium text-base"
          >
            FAQ
          </button>
        </nav>

        {/* Actions - Droite */}
        <div className="flex items-center">
          {!isChecking && user ? (
            <Link href="/dashboard">
              <Button className="bg-white text-foreground hover:bg-white/90 px-8 py-1 rounded-full font-medium text-base shadow-lg">
                Tableau de bord
              </Button>
            </Link>
          ) : !isChecking ? (
            <div className="hidden md:flex items-center gap-3">
              <Link href="/auth/login">
                <Button className="bg-white text-foreground hover:bg-white/90 px-5 py-1 rounded-full font-medium text-sm shadow-lg">
                  Connexion
                </Button>
              </Link>
              <Link href="/auth/signup">
                <Button className="bg-white text-foreground hover:bg-white/90 px-5 py-1 rounded-full font-medium text-sm shadow-lg">
                  Inscription
                </Button>
              </Link>
            </div>
          ) : null}

          {/* Menu Mobile */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col space-y-4 mt-8">
                <button 
                  onClick={() => scrollToSection('features-section')}
                  className="text-left text-foreground hover:text-primary transition-colors py-2 font-medium text-base"
                >
                  Fonctionnalités
                </button>
                <button 
                  onClick={() => scrollToSection('pricing-section')}
                  className="text-left text-foreground hover:text-primary transition-colors py-2 font-medium text-base"
                >
                  Tarifs
                </button>
                <button 
                  onClick={() => scrollToSection('faq-section')}
                  className="text-left text-foreground hover:text-primary transition-colors py-2 font-medium text-base"
                >
                  FAQ
                </button>
                <div className="border-t pt-4 space-y-2">
                  {!isChecking && user ? (
                    <Link href="/dashboard" className="block">
                      <Button className="w-full justify-start bg-white text-foreground hover:bg-white/90 px-8 py-1 rounded-full font-medium text-base shadow-lg">
                        Tableau de bord
                      </Button>
                    </Link>
                  ) : !isChecking ? (
                    <div className="flex flex-col gap-2">
                    <Link href="/auth/login" className="block">
                      <Button className="w-full justify-start bg-white text-foreground hover:bg-white/90 px-7 py-1 rounded-full font-medium text-sm shadow-lg">
                          Connexion
                        </Button>
                      </Link>
                      <Link href="/auth/signup" className="block">
                      <Button className="w-full justify-start bg-white text-foreground hover:bg-white/90 px-7 py-1 rounded-full font-medium text-sm shadow-lg">
                          Inscription
                        </Button>
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
