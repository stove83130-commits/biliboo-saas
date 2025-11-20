"use client"

import React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutGrid, Receipt, ArrowDownToLine, BarChart2, Settings, RefreshCw, LogOut, ChevronDown, HelpCircle, CreditCard, User2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useState, useEffect } from "react"
import type { User } from "@supabase/supabase-js"
import { WorkspaceSwitcher } from "./workspace-switcher"
import Image from "next/image"

const navigation = [
  { name: "Tableau de bord", href: "/dashboard", icon: LayoutGrid },
  { name: "Factures", href: "/dashboard/invoices", icon: Receipt },
  { name: "Exports", href: "/dashboard/exports", icon: ArrowDownToLine },
  { name: "Statistiques", href: "/dashboard/analytics", icon: BarChart2 },
  { name: "Extraction", href: "/dashboard/extraction", icon: RefreshCw },
  { name: "Connecteur", href: "/dashboard/settings", icon: Settings },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [openMenu, setOpenMenu] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      // Utiliser getSession() au lieu de getUser() pour éviter les problèmes de refresh token
      const { data: { session }, error } = await supabase.auth.getSession()
      const user = session?.user || null
      
      // Vérifier si l'utilisateur a un email valide
      if (user && !user.email) {
        console.error('❌ Utilisateur sans email détecté, déconnexion forcée')
        await supabase.auth.signOut()
        router.push('/auth/signup?error=no_email')
        return
      }
      
      setUser(user)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user
      
      // Vérifier si l'utilisateur a un email valide
      if (currentUser && !currentUser.email) {
        console.error('❌ Utilisateur sans email détecté, déconnexion forcée')
        await supabase.auth.signOut()
        router.push('/auth/signup?error=no_email')
        return
      }
      
      setUser(currentUser ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const getUserInitials = () => {
    if (!user?.user_metadata?.full_name && !user?.email) return 'U'
    const name = user?.user_metadata?.full_name || user?.email
    return name.substring(0, 2).toUpperCase()
  }

  const getUserName = () => {
    return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  }

  const getUserEmail = () => {
    // Ne pas logger d'erreur si l'utilisateur est simplement en cours de chargement
    if (user && !user.email) {
      console.error('❌ Aucun email disponible pour cet utilisateur')
    }
    return user?.email || 'Chargement...'
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-64 border-r border-border lg:block relative">
      {/* Dégradé continu avec la top bar */}
      <div className="absolute inset-0 z-0">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 256 1000"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Forme principale qui s'étend vers la top bar */}
          <g filter="url(#filter0_sidebar)">
            <path
              d="M256 -50V-100H300V1100H0V800C50 800 200 400 256 -50Z"
              fill="url(#paint0_linear_sidebar)"
            />
          </g>
          
          {/* Forme secondaire qui continue le flux */}
          <g filter="url(#filter1_sidebar)">
            <path
              d="M240 -80V-130H280V1070H0V770C40 770 180 370 240 -80Z"
              fill="url(#paint1_linear_sidebar)"
              fillOpacity="0.7"
            />
          </g>
          
          {/* Extension vers la top bar */}
          <g filter="url(#filter2_sidebar)">
            <path
              d="M256 -20V-60H280V120H0V80C50 80 200 20 256 -20Z"
              fill="url(#paint2_linear_sidebar)"
              fillOpacity="0.5"
            />
          </g>
          
          {/* Fond de base pour éviter le blanc */}
          <g filter="url(#filter3_sidebar)">
            <rect
              x="0"
              y="-100"
              width="256"
              height="1200"
              fill="url(#paint3_linear_sidebar)"
            />
          </g>
          
          {/* Formes géométriques dispersées */}
          <g opacity="0.2">
            <rect x="40" y="200" width="60" height="60" fill="hsl(var(--primary))" fillOpacity="0.08" />
            <rect x="120" y="400" width="80" height="40" fill="hsl(var(--primary))" fillOpacity="0.06" />
            <rect x="60" y="600" width="100" height="30" fill="hsl(var(--primary))" fillOpacity="0.1" />
            <rect x="140" y="800" width="70" height="50" fill="hsl(var(--primary))" fillOpacity="0.07" />
            {/* Formes près de la top bar */}
            <rect x="180" y="20" width="50" height="20" fill="hsl(var(--primary))" fillOpacity="0.09" />
            <rect x="200" y="40" width="40" height="15" fill="hsl(var(--primary))" fillOpacity="0.08" />
          </g>
          
          <defs>
            <filter
              id="filter0_sidebar"
              x="-50"
              y="-200"
              width="450"
              height="1400"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
              <feGaussianBlur stdDeviation="40" result="effect1_foregroundBlur_sidebar" />
            </filter>
            <filter
              id="filter1_sidebar"
              x="-70"
              y="-230"
              width="450"
              height="1400"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
              <feGaussianBlur stdDeviation="60" result="effect1_foregroundBlur_sidebar" />
            </filter>
            <filter
              id="filter2_sidebar"
              x="100"
              y="-100"
              width="250"
              height="300"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
              <feGaussianBlur stdDeviation="25" result="effect1_foregroundBlur_sidebar" />
            </filter>
            <filter
              id="filter3_sidebar"
              x="-50"
              y="-200"
              width="400"
              height="1400"
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
              <feGaussianBlur stdDeviation="15" result="effect1_foregroundBlur_sidebar" />
            </filter>
            <linearGradient
              id="paint0_linear_sidebar"
              x1="175"
              y1="-100"
              x2="175"
              y2="1100"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="hsl(var(--foreground))" stopOpacity="0.04" />
              <stop offset="0.2" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
              <stop offset="0.5" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
              <stop offset="0.8" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
              <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
            </linearGradient>
            <linearGradient
              id="paint1_linear_sidebar"
              x1="155"
              y1="-130"
              x2="155"
              y2="1070"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="hsl(var(--foreground))" stopOpacity="0.02" />
              <stop offset="0.3" stopColor="hsl(var(--primary))" stopOpacity="0.06" />
              <stop offset="0.6" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
              <stop offset="0.9" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
              <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient
              id="paint2_linear_sidebar"
              x1="220"
              y1="-60"
              x2="220"
              y2="120"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="hsl(var(--primary))" stopOpacity="0.1" />
              <stop offset="0.5" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
              <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
            </linearGradient>
            <linearGradient
              id="paint3_linear_sidebar"
              x1="128"
              y1="-100"
              x2="128"
              y2="1100"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="hsl(var(--primary))" stopOpacity="0.02" />
              <stop offset="0.1" stopColor="hsl(var(--primary))" stopOpacity="0.04" />
              <stop offset="0.3" stopColor="hsl(var(--primary))" stopOpacity="0.06" />
              <stop offset="0.7" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
              <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      
      <div className="flex h-full flex-col relative z-10">
        {/* Logo */}
        <div className="flex h-12 items-center border-b border-border px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image 
              src="/logos/logo%20off.png" 
              alt="Bilibou Logo" 
              width={48} 
              height={48}
              className="h-12 w-auto"
            />
            <span className="text-base font-semibold text-black">Bilibou</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-black/10 text-black font-semibold"
                    : "text-black/80 hover:bg-black/5 hover:text-black",
                )}
              >
                <item.icon className="h-4 w-4" strokeWidth={1.5} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Workspace Switcher */}
        <div className="p-4">
          <WorkspaceSwitcher />
        </div>

        {/* User section avec menu */}
        <div className="border-t border-border p-4">
          <div className="relative">
            <button onClick={() => setOpenMenu(v => !v)} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-black/5 transition-colors">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-xs font-semibold text-white">
                {getUserInitials()}
              </div>
              <div className="flex-1 text-left text-xs">
                <p className="font-medium text-black">{getUserName()}</p>
                <p className="text-black/60">{getUserEmail()}</p>
              </div>
              <ChevronDown className={`h-4 w-4 text-black/60 transition-transform ${openMenu ? 'rotate-180' : ''}`} strokeWidth={1.8} />
            </button>
            {openMenu && (
              <div className="absolute bottom-10 left-0 right-0 z-10 rounded-lg border border-black/20 bg-white shadow-lg overflow-hidden">
                <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 flex items-center gap-2 text-black">
                  <LogOut className="h-4 w-4 text-black/60" strokeWidth={1.8} />
                  <span>Se déconnecter</span>
                </button>
                <Link href="/settings/personal" className="block px-3 py-2 text-sm hover:bg-black/5 flex items-center gap-2 text-black">
                  <User2 className="h-4 w-4 text-black/60" strokeWidth={1.8} />
                  <span>Paramètres personnels</span>
                </Link>
                <a href="mailto:contact@bilibou.com" className="block px-3 py-2 text-sm hover:bg-black/5 flex items-center gap-2 text-black">
                  <HelpCircle className="h-4 w-4 text-black/60" strokeWidth={1.8} />
                  <span>Aide</span>
                </a>
                <Link href="/settings/billing" className="block px-3 py-2 text-sm hover:bg-black/5 flex items-center gap-2 text-black">
                  <CreditCard className="h-4 w-4 text-black/60" strokeWidth={1.8} />
                  <span>Facturation</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}

