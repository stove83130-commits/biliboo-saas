"use client"

import { Button } from "@/components/ui/button"
import { WorkspaceSwitcher } from "./workspace-switcher"
import { Input } from "@/components/ui/input"
import { Search, Plus, Bell } from "lucide-react"

export function DashboardHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-xl font-semibold text-foreground">Tableau de bord</h1>
      <div className="flex items-center gap-3">
        <WorkspaceSwitcher />
        <div className="relative hidden sm:block">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.5}
          />
          <Input
            placeholder="Rechercher..."
            className="w-64 border-border bg-background pl-10 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <Button className="gap-2 text-sm">
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          Nouvelle facture
        </Button>
      </div>
    </div>
  )
}



