"use client"

import React, { type ReactNode } from "react"
import { DashboardSidebar } from "./dashboard-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Bell } from "lucide-react"
import { WorkspaceSwitchingOverlay } from "./workspace-switching-overlay"

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          {/* Top bar avec sélecteur d'espace */}
          <div className="sticky top-0 z-50 border-b border-border px-6 h-12 flex items-center justify-end relative">
            {/* Continuation du design de la sidebar */}
            <div className="absolute inset-0 z-0">
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 1200 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid slice"
              >
                {/* Extension directe de la sidebar - forme principale */}
                <g filter="url(#filter0_topbar)">
                  <path
                    d="M0 -20V-40H1200V88H0V60C80 60 0 -20 0 -20Z"
                    fill="url(#paint0_linear_topbar)"
                  />
                </g>
                
                {/* Forme secondaire qui s'étend depuis la sidebar */}
                <g filter="url(#filter1_topbar)">
                  <path
                    d="M0 -30V-50H1200V78H0V50C60 50 0 -30 0 -30Z"
                    fill="url(#paint1_linear_topbar)"
                    fillOpacity="0.8"
                  />
                </g>
                
                {/* Forme tertiaire pour la continuité */}
                <g filter="url(#filter2_topbar)">
                  <path
                    d="M0 -10V-30H1200V68H0V40C40 40 0 -10 0 -10Z"
                    fill="url(#paint2_linear_topbar)"
                    fillOpacity="0.6"
                  />
                </g>
                
                {/* Forme de base pour éviter le blanc */}
                <g filter="url(#filter3_topbar)">
                  <rect
                    x="0"
                    y="-50"
                    width="1200"
                    height="150"
                    fill="url(#paint3_linear_topbar)"
                  />
                </g>
                
                {/* Forme supplémentaire pour combler le trou blanc */}
                <g filter="url(#filter4_topbar)">
                  <rect
                    x="0"
                    y="-30"
                    width="300"
                    height="100"
                    fill="url(#paint4_linear_topbar)"
                  />
                </g>
                
                {/* Formes géométriques qui s'étendent depuis le début */}
                <g opacity="0.15">
                  <rect x="50" y="8" width="80" height="32" fill="hsl(var(--primary))" fillOpacity="0.08" />
                  <rect x="200" y="12" width="100" height="24" fill="hsl(var(--primary))" fillOpacity="0.06" />
                  <rect x="400" y="6" width="150" height="36" fill="hsl(var(--primary))" fillOpacity="0.07" />
                  <rect x="600" y="10" width="200" height="28" fill="hsl(var(--primary))" fillOpacity="0.05" />
                  <rect x="850" y="14" width="120" height="20" fill="hsl(var(--primary))" fillOpacity="0.06" />
                  <rect x="1050" y="8" width="100" height="32" fill="hsl(var(--primary))" fillOpacity="0.04" />
                </g>
                
                <defs>
                  <filter
                    id="filter0_topbar"
                    x="100"
                    y="-60"
                    width="1200"
                    height="150"
                    filterUnits="userSpaceOnUse"
                    colorInterpolationFilters="sRGB"
                  >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feGaussianBlur stdDeviation="25" result="effect1_foregroundBlur_topbar" />
                  </filter>
                  <filter
                    id="filter1_topbar"
                    x="80"
                    y="-70"
                    width="1200"
                    height="150"
                    filterUnits="userSpaceOnUse"
                    colorInterpolationFilters="sRGB"
                  >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feGaussianBlur stdDeviation="35" result="effect1_foregroundBlur_topbar" />
                  </filter>
                  <filter
                    id="filter2_topbar"
                    x="120"
                    y="-50"
                    width="1200"
                    height="150"
                    filterUnits="userSpaceOnUse"
                    colorInterpolationFilters="sRGB"
                  >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feGaussianBlur stdDeviation="20" result="effect1_foregroundBlur_topbar" />
                  </filter>
                  <filter
                    id="filter3_topbar"
                    x="-50"
                    y="-100"
                    width="1300"
                    height="200"
                    filterUnits="userSpaceOnUse"
                    colorInterpolationFilters="sRGB"
                  >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feGaussianBlur stdDeviation="10" result="effect1_foregroundBlur_topbar" />
                  </filter>
                  <filter
                    id="filter4_topbar"
                    x="-50"
                    y="-80"
                    width="400"
                    height="150"
                    filterUnits="userSpaceOnUse"
                    colorInterpolationFilters="sRGB"
                  >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feGaussianBlur stdDeviation="8" result="effect1_foregroundBlur_topbar" />
                  </filter>
                  <linearGradient
                    id="paint0_linear_topbar"
                    x1="0"
                    y1="-20"
                    x2="1200"
                    y2="68"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="hsl(var(--primary))" stopOpacity="0.15" />
                    <stop offset="0.2" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
                    <stop offset="0.5" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
                    <stop offset="0.8" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
                    <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
                  </linearGradient>
                  <linearGradient
                    id="paint1_linear_topbar"
                    x1="0"
                    y1="-30"
                    x2="1200"
                    y2="58"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="hsl(var(--primary))" stopOpacity="0.12" />
                    <stop offset="0.3" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                    <stop offset="0.6" stopColor="hsl(var(--primary))" stopOpacity="0.06" />
                    <stop offset="0.9" stopColor="hsl(var(--primary))" stopOpacity="0.03" />
                    <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.01" />
                  </linearGradient>
                  <linearGradient
                    id="paint2_linear_topbar"
                    x1="0"
                    y1="-30"
                    x2="1200"
                    y2="68"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="hsl(var(--primary))" stopOpacity="0.12" />
                    <stop offset="0.3" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                    <stop offset="0.6" stopColor="hsl(var(--primary))" stopOpacity="0.06" />
                    <stop offset="0.9" stopColor="hsl(var(--primary))" stopOpacity="0.03" />
                    <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.01" />
                  </linearGradient>
                  <linearGradient
                    id="paint3_linear_topbar"
                    x1="0"
                    y1="-50"
                    x2="1200"
                    y2="100"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="hsl(var(--primary))" stopOpacity="0.05" />
                    <stop offset="0.2" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
                    <stop offset="0.5" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                    <stop offset="0.8" stopColor="hsl(var(--primary))" stopOpacity="0.06" />
                    <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.03" />
                  </linearGradient>
                  <linearGradient
                    id="paint4_linear_topbar"
                    x1="0"
                    y1="-30"
                    x2="300"
                    y2="70"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="hsl(var(--primary))" stopOpacity="0.12" />
                    <stop offset="0.3" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
                    <stop offset="0.7" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                    <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            
            <div className="flex items-center gap-3 relative z-10">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Bell className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          </div>
          
          {/* Contenu principal */}
          <main className="flex-1 p-4 lg:p-6">
            <div className="mx-auto max-w-full">{children}</div>
          </main>
        </div>
      </div>
      <WorkspaceSwitchingOverlay />
    </SidebarProvider>
  )
}












