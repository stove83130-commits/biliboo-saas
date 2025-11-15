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
    const init = async () => {
      try {
        // Vérifier à la fois l'utilisateur ET la session pour être sûr
        const getUserPromise = supabase.auth.getUser()
        const getSessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<{ data: { user: null, session: null }, error: null }>((resolve) => 
          setTimeout(() => resolve({ data: { user: null, session: null }, error: null }), 1000)
        )
        
        const [userResult, sessionResult] = await Promise.all([
          Promise.race([getUserPromise, timeoutPromise]) as any,
          Promise.race([getSessionPromise, timeoutPromise]) as any
        ])
        
        if (mounted) {
          // L'utilisateur n'est considéré comme connecté que si:
          // 1. Il y a un utilisateur avec un email valide
          // 2. ET il y a une session valide ET non expirée
          const user = userResult.data?.user
          const session = sessionResult.data?.session
          
          const hasValidUser = user && user.email
          const hasValidSession = session && session.expires_at
          
          // Vérifier que la session n'est pas expirée
          let isSessionExpired = false
          if (hasValidSession) {
            const expiresAt = session.expires_at * 1000 // Convertir en millisecondes
            const now = Date.now()
            isSessionExpired = expiresAt < now
          }
          
          if (hasValidUser && hasValidSession && !isSessionExpired) {
            setUser(user)
            userRef.current = user
          } else {
            // Si la session est expirée ou invalide, nettoyer
            if (isSessionExpired || (session && !hasValidUser)) {
              try {
                await supabase.auth.signOut()
              } catch (e) {
                // Ignorer les erreurs de déconnexion
              }
            }
            setUser(null)
            userRef.current = null
          }
          setIsChecking(false)
        }
      } catch (error) {
        if (mounted) {
          setUser(null)
          userRef.current = null
          setIsChecking(false)
        }
      }
    }
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      // Ignorer les événements TOKEN_REFRESHED si on n'a pas d'utilisateur actuellement
      // Cela évite que le bouton apparaisse après un refresh de token sur une page publique
      if (event === 'TOKEN_REFRESHED' && !userRef.current) {
        // Re-vérifier la session pour être sûr
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        if (!currentSession || !currentSession.user || !currentSession.user.email) {
          setUser(null)
          userRef.current = null
          setIsChecking(false)
          return
        }
      }
      
      // Si l'événement est SIGNED_OUT, forcer user à null
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null)
        userRef.current = null
        setIsChecking(false)
        return
      }
      
      // Pour tous les autres événements, vérifier strictement la session
      if (session && session.user && session.user.email) {
        const expiresAt = session.expires_at ? session.expires_at * 1000 : null
        const now = Date.now()
        
        // Vérifier que la session n'est pas expirée
        if (expiresAt && expiresAt > now) {
          // Double vérification : re-vérifier avec getSession() pour être sûr
          const { data: { session: verifiedSession } } = await supabase.auth.getSession()
          if (verifiedSession && verifiedSession.user && verifiedSession.user.email) {
            const verifiedExpiresAt = verifiedSession.expires_at ? verifiedSession.expires_at * 1000 : null
            if (verifiedExpiresAt && verifiedExpiresAt > now) {
              setUser(verifiedSession.user)
              userRef.current = verifiedSession.user
            } else {
              setUser(null)
              userRef.current = null
              supabase.auth.signOut().catch(() => {})
            }
          } else {
            setUser(null)
            userRef.current = null
          }
        } else {
          // Session expirée
          setUser(null)
          userRef.current = null
          supabase.auth.signOut().catch(() => {})
        }
      } else {
        setUser(null)
        userRef.current = null
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
