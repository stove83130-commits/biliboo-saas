import Image from "next/image"
import type React from "react"

interface ParallelCodingAgentsProps {
  className?: string
}

const ParallelCodingAgents: React.FC<ParallelCodingAgentsProps> = ({ className = "" }) => {
  return (
    <div className={`w-full h-full relative ${className}`}>
      <Image
        src="/features/export-multi-format.png/Capture d’écran 2025-10-13 120105.png"
        alt="Export multi-format en 1 clic"
        fill
        className="object-contain"
        style={{ borderRadius: "32px", clipPath: "inset(0 round 32px)" }}
        priority
      />
    </div>
  )
}

export default ParallelCodingAgents
