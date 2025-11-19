"use client"

import React, { useEffect, useState } from "react"
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
  const pathname = usePathname()

  useEffect(() => {
    let mounted = true
    const init = async () => {
      // getSession() est maintenant wrappé dans createClient() pour vérifier le cookie automatiquement
      const { data: { session } } = await supabase.auth.getSession()
      if (mounted) setUser(session?.user ?? null)
    }
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase.auth])
  
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
          {user ? (
            <Link href="/dashboard">
              <Button className="bg-white text-foreground hover:bg-white/90 px-8 py-1 rounded-full font-medium text-base shadow-lg">
                Tableau de bord
              </Button>
            </Link>
          ) : (
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
          )}

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
                  {user ? (
                    <Link href="/dashboard" className="block">
                      <Button className="w-full justify-start bg-white text-foreground hover:bg-white/90 px-8 py-1 rounded-full font-medium text-base shadow-lg">
                        Tableau de bord
                      </Button>
                    </Link>
                  ) : (
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
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
