import Image from "next/image"
import type React from "react"

interface DeploymentEasyProps {
  width?: number | string
  height?: number | string
  className?: string
}

const DeploymentEasy: React.FC<DeploymentEasyProps> = ({ width = "100%", height = "100%", className = "" }) => {
  return (
    <div className={`w-full h-full relative ${className}`} style={{ width, height }}>
      <Image
        src="/features/collaboration-equipe.png/Capture d’écran 2025-10-13 160634.png"
        alt="Collaboration d'équipe"
        fill
        className="object-contain"
        style={{ borderRadius: "32px", clipPath: "inset(0 round 32px)" }}
        priority
      />
    </div>
  )
}

export default DeploymentEasy
