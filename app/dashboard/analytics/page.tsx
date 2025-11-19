"use client"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, TrendingDown, Euro, Receipt, PieChart as PieChartIcon } from "lucide-react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { AuthGuard } from "@/components/auth-guard"
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart
} from 'recharts'

interface Invoice {
  id: string
  date: string
  amount: number
  category: string
  payment_status: string
  vendor: string
}

interface KPIData {
  totalThisMonth: number
  avgPerDay: number
  topCategory: { name: string; percentage: number }
  trend: number
}

interface MonthlyData {
  month: string
  total: number
  receipts: number
  avg3Months: number
}

interface CategoryData {
  month: string
  [key: string]: number | string
}

interface TopCategory {
  name: string
  value: number
  percentage: number
  color: string
  receipts: number
}

const COLORS = [
  '#10b981', // green-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
]

export default function AnalyticsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'validated'>('all')
  const [kpis, setKpis] = useState<KPIData>({
    totalThisMonth: 0,
    avgPerDay: 0,
    topCategory: { name: '-', percentage: 0 },
    trend: 0
  })
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [topCategories, setTopCategories] = useState<TopCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categoryInvoices, setCategoryInvoices] = useState<Invoice[]>([])

  const supabase = createClient()

  useEffect(() => {
    fetchInvoices()
  }, [filter])

  // Rafraîchir quand le workspace change
  useEffect(() => {
    const handleWorkspaceChange = () => {
      console.log('🔄 [ANALYTICS] Workspace changé, rafraîchissement des données...')
      fetchInvoices()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('workspace:changed', handleWorkspaceChange)
      return () => {
        window.removeEventListener('workspace:changed', handleWorkspaceChange)
      }
    }
  }, [])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Récupérer le workspace actif
      const activeWorkspaceId = typeof window !== 'undefined' 
        ? localStorage.getItem('active_workspace_id') 
        : null

      console.log('🔍 [ANALYTICS] Workspace ID:', activeWorkspaceId)

      // OPTIMISATION: Afficher la page immédiatement avec des données vides
      setLoading(false)

      // Déterminer le type de workspace (comme dans invoice-table-new.tsx)
      let isPersonalWorkspace = false
      if (activeWorkspaceId && activeWorkspaceId.trim() !== '') {
        try {
          const workspaceResponse = await fetch('/api/workspaces')
          if (workspaceResponse.ok) {
            const workspaceData = await workspaceResponse.json()
            const workspace = workspaceData.workspaces?.find((w: any) => w.id === activeWorkspaceId)
            if (workspace) {
              isPersonalWorkspace = workspace.type === 'personal'
              console.log('🔍 [ANALYTICS] Type workspace:', workspace.type, 'isPersonal:', isPersonalWorkspace)
            } else {
              // Workspace non trouvé, considérer comme personnel par défaut
              isPersonalWorkspace = true
              console.log('⚠️ [ANALYTICS] Workspace non trouvé, considéré comme personnel')
            }
          } else {
            isPersonalWorkspace = true
            console.log('⚠️ [ANALYTICS] Erreur API workspaces, considéré comme personnel')
          }
        } catch (error) {
          console.warn('⚠️ [ANALYTICS] Erreur lors de la vérification du type de workspace:', error)
          isPersonalWorkspace = true
        }
      } else {
        // Pas de workspace actif = workspace personnel
        isPersonalWorkspace = true
        console.log('🔍 [ANALYTICS] Pas de workspace actif, considéré comme personnel')
      }

      // Charger toutes les factures puis filtrer côté client (comme dans invoice-table-new.tsx)
      // Ne pas filtrer par amount car certaines factures peuvent avoir amount = 0 ou dans extracted_data
      let query = supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (filter === 'validated') {
        query = query.eq('payment_status', 'paid')
      }

      const { data: allInvoices, error } = await query

      if (error) {
        console.error('❌ [ANALYTICS] Erreur chargement factures:', error)
        return
      }

      console.log('🔍 [ANALYTICS] Total factures récupérées:', allInvoices?.length || 0)
      
      // Afficher les workspace_id des factures pour déboguer
      if (allInvoices && allInvoices.length > 0) {
        const workspaceIds = allInvoices.map((inv: any) => inv.workspace_id)
        console.log('🔍 [ANALYTICS] Workspace IDs des factures:', [...new Set(workspaceIds)])
        console.log('🔍 [ANALYTICS] Exemple facture:', { 
          id: allInvoices[0].id, 
          workspace_id: allInvoices[0].workspace_id,
          amount: allInvoices[0].amount,
          vendor: allInvoices[0].vendor
        })
      }

      // Filtrer par workspace côté client (comme dans invoice-table-new.tsx)
      let invoices = allInvoices || []
      
      if (isPersonalWorkspace) {
        // Workspace personnel : workspace_id est null ou 'personal'
        invoices = invoices.filter((inv: any) => 
          inv.workspace_id === null || 
          inv.workspace_id === 'personal' || 
          !inv.workspace_id
        )
        console.log('🔍 [ANALYTICS] Après filtrage workspace personnel:', invoices.length)
      } else {
        // Workspace d'organisation : filtrer par workspace_id
        console.log('🔍 [ANALYTICS] Filtrage workspace organisation:', activeWorkspaceId)
        invoices = invoices.filter((inv: any) => inv.workspace_id === activeWorkspaceId)
        console.log('🔍 [ANALYTICS] Après filtrage workspace organisation:', invoices.length)
      }

      const invoicesData = invoices.map((inv: any) => {
        // Essayer plusieurs sources pour le montant
        const amount = Number(inv.amount) || Number(inv.total_ttc) || Number(inv?.extracted_data?.amounts?.total) || Number(inv?.extracted_data?.total_ttc) || Number(inv?.extracted_data?.amount) || 0
        
        // Essayer plusieurs sources pour la date
        const date = inv.date || inv.invoice_date || inv.created_at || inv?.extracted_data?.invoice_date || inv?.extracted_data?.date
        
        return {
          id: inv.id,
          date: date,
          amount: amount,
          category: inv.category || 'Autre',
          payment_status: inv.payment_status || 'unpaid',
          vendor: inv.vendor || inv.supplier_name || inv?.extracted_data?.supplier?.name || 'Inconnu'
        }
      }).filter(inv => inv.amount > 0) // Filtrer les factures sans montant

      console.log('✅ [ANALYTICS] Factures chargées:', invoicesData.length)
      console.log('🔍 [ANALYTICS] Exemple de facture:', invoicesData[0])
      console.log('🔍 [ANALYTICS] Montants:', invoicesData.map(inv => ({ id: inv.id, amount: inv.amount, date: inv.date })))
      setInvoices(invoicesData)
      calculateAnalytics(invoicesData)
    } catch (error) {
      console.error('❌ [ANALYTICS] Erreur:', error)
      setLoading(false)
    }
  }

  const calculateAnalytics = (data: Invoice[]) => {
    console.log('🔍 [ANALYTICS] Calcul avec', data.length, 'factures')
    
    // KPIs
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    // Filtrer les factures du mois en cours avec gestion des dates invalides
    const thisMonthInvoices = data.filter(inv => {
      if (!inv.date) return false
      const invDate = new Date(inv.date)
      if (isNaN(invDate.getTime())) return false
      return invDate >= firstDayOfMonth
    })
    
    console.log('🔍 [ANALYTICS] Factures ce mois:', thisMonthInvoices.length)
    
    const totalThisMonth = thisMonthInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
    const daysInMonth = now.getDate()
    const avgPerDay = daysInMonth > 0 ? totalThisMonth / daysInMonth : 0
    
    console.log('🔍 [ANALYTICS] Total ce mois:', totalThisMonth)

    // Catégorie top
    const categoryTotals = data.reduce((acc, inv) => {
      const category = inv.category || 'Autre'
      acc[category] = (acc[category] || 0) + (inv.amount || 0)
      return acc
    }, {} as Record<string, number>)

    const topCat = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]
    const totalAll = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0)
    
    console.log('🔍 [ANALYTICS] Catégories:', categoryTotals)
    console.log('🔍 [ANALYTICS] Top catégorie:', topCat)

    // Trend (comparaison avec mois dernier)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    const lastMonthInvoices = data.filter(inv => {
      if (!inv.date) return false
      const d = new Date(inv.date)
      if (isNaN(d.getTime())) return false
      return d >= lastMonth && d <= lastMonthEnd
    })
    const totalLastMonth = lastMonthInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
    const trend = totalLastMonth > 0 ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100 : 0
    
    console.log('🔍 [ANALYTICS] Total mois dernier:', totalLastMonth)
    console.log('🔍 [ANALYTICS] Trend:', trend)

    setKpis({
      totalThisMonth,
      avgPerDay,
      topCategory: {
        name: topCat?.[0] || '-',
        percentage: topCat ? (topCat[1] / totalAll) * 100 : 0
      },
      trend
    })

    // Données mensuelles (12 derniers mois)
    const monthlyMap = new Map<string, { total: number; receipts: number }>()
    
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyMap.set(key, { total: 0, receipts: 0 })
    }

    data.forEach(inv => {
      const d = new Date(inv.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (monthlyMap.has(key)) {
        const current = monthlyMap.get(key)!
        monthlyMap.set(key, {
          total: current.total + inv.amount,
          receipts: current.receipts + 1
        })
      }
    })

    const monthlyArray = Array.from(monthlyMap.entries()).map(([key, value]) => {
      const [year, month] = key.split('-')
      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
      return {
        month: monthNames[parseInt(month) - 1],
        total: Math.round(value.total),
        receipts: value.receipts,
        avg3Months: 0
      }
    })

    // Moyenne mobile sur 3 mois
    monthlyArray.forEach((item, index) => {
      if (index >= 2) {
        const sum = monthlyArray[index - 2].total + monthlyArray[index - 1].total + item.total
        item.avg3Months = Math.round(sum / 3)
      }
    })

    setMonthlyData(monthlyArray)

    // Données par catégorie (stacked)
    const categoryByMonth = new Map<string, Record<string, number>>()
    
    monthlyMap.forEach((_, key) => {
      categoryByMonth.set(key, {})
    })

    data.forEach(inv => {
      const d = new Date(inv.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (categoryByMonth.has(key)) {
        const monthData = categoryByMonth.get(key)!
        monthData[inv.category] = (monthData[inv.category] || 0) + inv.amount
      }
    })

    const categoryArray = Array.from(categoryByMonth.entries()).map(([key, categories]) => {
      const [year, month] = key.split('-')
      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
      return {
        month: monthNames[parseInt(month) - 1],
        ...categories
      }
    })

    setCategoryData(categoryArray)

    // Top 5 catégories
    const topCats = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value], index) => ({
        name,
        value: Math.round(value),
        percentage: (value / totalAll) * 100,
        color: COLORS[index % COLORS.length],
        receipts: data.filter(inv => inv.category === name).length
      }))

    setTopCategories(topCats)
  }

  const handleCategoryClick = (categoryName: string) => {
    setSelectedCategory(categoryName)
    const filtered = invoices.filter(inv => inv.category === categoryName)
    setCategoryInvoices(filtered)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  if (loading) {
    return (
      <AuthGuard>
        <DashboardLayout>
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement des analytics...</p>
            </div>
          </div>
        </DashboardLayout>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
              <p className="text-sm text-gray-600 mt-1">Vue d'ensemble de vos dépenses</p>
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as 'all' | 'validated')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les reçus</SelectItem>
                <SelectItem value="validated">Reçus validés uniquement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total ce mois */}
            <Card className="p-5 border-0 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <Euro className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Dépenses totales</p>
                  <p className="text-xs text-gray-400">Ce mois</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-2">{formatCurrency(kpis.totalThisMonth)}</p>
              <div className="flex items-center gap-1">
                {kpis.trend >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-green-500" />
                )}
                <span className={`text-xs font-medium ${kpis.trend >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {Math.abs(kpis.trend).toFixed(1)}%
                </span>
                <span className="text-xs text-gray-400">vs mois dernier</span>
              </div>
            </Card>

            {/* Moyenne par jour */}
            <Card className="p-5 border-0 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Dépenses moyennes</p>
                  <p className="text-xs text-gray-400">Par jour</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-2">{formatCurrency(kpis.avgPerDay)}</p>
              <p className="text-xs text-gray-400">Basé sur {new Date().getDate()} jours</p>
            </Card>

            {/* Top catégorie */}
            <Card className="p-5 border-0 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 bg-amber-50 rounded-lg flex items-center justify-center">
                  <PieChartIcon className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Catégorie #1</p>
                  <p className="text-xs text-gray-400">Plus de dépenses</p>
                </div>
              </div>
              <p className="text-lg font-bold text-gray-900 truncate mb-2">{kpis.topCategory.name}</p>
              <p className="text-xs text-gray-400">{kpis.topCategory.percentage.toFixed(1)}% du total</p>
            </Card>

            {/* Nombre de reçus */}
            <Card className="p-5 border-0 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 bg-violet-50 rounded-lg flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Nombre de reçus</p>
                  <p className="text-xs text-gray-400">Ce mois</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-2">
                {invoices.filter(inv => {
                  const d = new Date(inv.date)
                  const now = new Date()
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
                }).length}
              </p>
              <p className="text-xs text-gray-400">Factures enregistrées</p>
            </Card>
          </div>

          {/* Graphique 1 : Dépenses mensuelles */}
          <Card className="p-6 border-0 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Dépenses totales par mois</h2>
                <p className="text-xs text-gray-500 mt-1">Évolution des 12 derniers mois avec moyenne mobile</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-green-600 rounded-full"></div>
                  <span className="text-xs text-gray-600">Dépenses</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-blue-600 rounded-full" style={{ borderTop: '2px dashed #3b82f6' }}></div>
                  <span className="text-xs text-gray-600">Moyenne 3 mois</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#d1d5db"
                  style={{ fontSize: '11px' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#d1d5db"
                  style={{ fontSize: '11px' }}
                  tickFormatter={(value) => `${value}€`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'total') return [formatCurrency(value), 'Dépenses']
                    if (name === 'avg3Months') return [formatCurrency(value), 'Moyenne 3 mois']
                    return [value, name]
                  }}
                  labelStyle={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: '#10b981' }}
                  name="Dépenses"
                />
                <Line 
                  type="monotone" 
                  dataKey="avg3Months" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 5, fill: '#3b82f6' }}
                  name="Moyenne 3 mois"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Graphique 2 : Dépenses par catégorie - Barres verticales */}
          <Card className="p-6 border-0 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Dépenses par catégorie</h2>
                <p className="text-xs text-gray-500 mt-1">Répartition des dépenses par catégorie</p>
              </div>
            </div>
            {topCategories.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topCategories}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                    <XAxis 
                      dataKey="name"
                      stroke="#d1d5db"
                      style={{ fontSize: '11px' }}
                      axisLine={false}
                      tickLine={false}
                      tick={false}
                      height={20}
                    />
                    <YAxis 
                      stroke="#d1d5db"
                      style={{ fontSize: '11px' }}
                      tickFormatter={(value) => `${value}€`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                      formatter={(value: any) => formatCurrency(value)}
                      labelStyle={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[8, 8, 0, 0]}
                      barSize={40}
                    >
                      {topCategories.map((cat, index) => (
                        <Cell key={`cell-${index}`} fill={cat.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Légende personnalisée */}
                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
                  {topCategories.map((cat) => (
                    <div key={cat.name} className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-full" 
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-xs text-gray-600">{cat.name}</span>
                      <span className="text-xs text-gray-400">({formatCurrency(cat.value)})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-gray-400">
                <div className="text-center">
                  <p className="text-sm">Aucune donnée disponible</p>
                  <p className="text-xs mt-1">Les dépenses par catégorie apparaîtront ici</p>
                </div>
              </div>
            )}
          </Card>

          {/* Graphique 3 : Top 5 catégories avec détails */}
          <Card className="p-6 border-0 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Top 5 catégories</h2>
                <p className="text-xs text-gray-500 mt-1">Répartition des dépenses par catégorie</p>
              </div>
            </div>

            {/* Barres horizontales minimalistes */}
            <div className="space-y-4 mb-6">
              {topCategories.map((cat, index) => (
                <button
                  key={cat.name}
                  onClick={() => handleCategoryClick(cat.name)}
                  className={`w-full text-left transition-all ${
                    selectedCategory === cat.name ? 'scale-[1.02]' : 'hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {index + 1}. {cat.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({cat.receipts} reçus)
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(cat.value)}</p>
                      <p className="text-xs text-gray-500">{cat.percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                  {/* Barre de progression */}
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${cat.percentage}%`,
                        backgroundColor: cat.color
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>

          </Card>

          {/* Liste détaillée des reçus de la catégorie sélectionnée */}
          {selectedCategory && categoryInvoices.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Reçus - {selectedCategory}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                >
                  Fermer
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Fournisseur</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Montant</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryInvoices.map((inv) => (
                      <tr key={inv.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {new Date(inv.date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">{inv.vendor}</td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {formatCurrency(inv.amount)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            inv.payment_status === 'paid' 
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {inv.payment_status === 'paid' ? 'Payé' : 'En attente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}

