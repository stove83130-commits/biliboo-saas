"use client"

import { motion } from "framer-motion"
import type { HTMLAttributes, ReactNode } from "react"

interface AnimatedSectionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  delay?: number
}

export function AnimatedSection({ children, className, delay = 0, ...props }: AnimatedSectionProps) {
  return (
    <motion.div
      initial={false}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.15 }}
      transition={{ duration: 0.8, ease: [0.33, 1, 0.68, 1], delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}
