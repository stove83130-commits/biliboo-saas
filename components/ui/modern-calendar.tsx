"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "./button"

interface ModernCalendarProps {
  selected?: Date
  onSelect: (date: Date | undefined) => void
  mode?: "single" | "range"
  selectedRange?: { from?: Date; to?: Date }
  onRangeSelect?: (range: { from?: Date; to?: Date }) => void
}

export function ModernCalendar({ 
  selected, 
  onSelect, 
  mode = "single",
  selectedRange,
  onRangeSelect 
}: ModernCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ]

  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7 // Lundi = 0

    const days: (Date | null)[] = []
    
    // Jours vides avant le 1er du mois
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  const isSameDay = (date1?: Date | null, date2?: Date | null) => {
    if (!date1 || !date2) return false
    return date1.toDateString() === date2.toDateString()
  }

  const isInRange = (date: Date) => {
    if (!selectedRange?.from || !selectedRange?.to) return false
    return date >= selectedRange.from && date <= selectedRange.to
  }

  const isToday = (date: Date) => {
    return isSameDay(date, new Date())
  }

  const handleDateClick = (date: Date) => {
    if (mode === "single") {
      onSelect(date)
    } else if (mode === "range" && onRangeSelect) {
      if (!selectedRange?.from || (selectedRange.from && selectedRange.to)) {
        // Commencer une nouvelle sélection
        onRangeSelect({ from: date, to: undefined })
      } else {
        // Compléter la sélection
        if (date < selectedRange.from) {
          onRangeSelect({ from: date, to: selectedRange.from })
        } else {
          onRangeSelect({ from: selectedRange.from, to: date })
        }
      }
    }
  }

  const days = getDaysInMonth(currentMonth)

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  return (
    <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={previousMonth}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-semibold text-gray-900">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={nextMonth}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grille des jours */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="aspect-square" />
          }

          const isSelected = mode === "single" 
            ? isSameDay(day, selected)
            : isSameDay(day, selectedRange?.from) || isSameDay(day, selectedRange?.to)
          const inRange = mode === "range" && isInRange(day)
          const today = isToday(day)

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDateClick(day)}
              className={`
                aspect-square rounded-md text-sm font-medium transition-all
                ${isSelected 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : inRange
                  ? 'bg-green-100 text-green-900 hover:bg-green-200'
                  : today
                  ? 'bg-gray-100 text-gray-900 font-bold hover:bg-gray-200'
                  : 'text-gray-700 hover:bg-gray-100'
                }
                ${!isSelected && !inRange && !today && 'hover:scale-105'}
              `}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>

      {/* Raccourcis rapides */}
      <div className="flex flex-wrap gap-1 mt-4 pt-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const today = new Date()
            if (mode === "single") {
              onSelect(today)
            } else if (onRangeSelect) {
              onRangeSelect({ from: today, to: today })
            }
          }}
          className="h-7 px-2 text-xs"
        >
          Aujourd'hui
        </Button>
        {mode === "range" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const today = new Date()
                const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
                onRangeSelect?.({ from: lastWeek, to: today })
              }}
              className="h-7 px-2 text-xs"
            >
              7 jours
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const today = new Date()
                const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
                onRangeSelect?.({ from: last30Days, to: today })
              }}
              className="h-7 px-2 text-xs"
            >
              30 jours
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
