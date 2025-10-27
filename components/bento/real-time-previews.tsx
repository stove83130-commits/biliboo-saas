"use client"

import type React from "react"
import Image from "next/image"

const RealtimeCodingPreviews: React.FC = () => {
  return (
    <div className="w-full h-full relative">
      <Image
        src="/features/categorisation-ia.png/Design sans titre (24).png"
        alt="Catégorisation intelligente par IA"
        fill
        className="object-contain"
        style={{ borderRadius: "32px", clipPath: "inset(0 round 32px)" }}
        priority
      />
    </div>
  )
}

export default RealtimeCodingPreviews