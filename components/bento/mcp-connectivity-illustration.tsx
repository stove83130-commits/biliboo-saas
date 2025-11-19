import Image from "next/image"
import type React from "react"

interface McpConnectivityIllustrationProps {
  className?: string
}

const McpConnectivityIllustration: React.FC<McpConnectivityIllustrationProps> = ({ className = "" }) => {
  return (
    <div className={`w-full h-full relative ${className}`}>
      <Image
        src="/features/recherche-ultra-rapide.png/Design sans titre (24).png"
        alt="Recherche ultra-rapide"
        fill
        className="object-contain"
        style={{ borderRadius: "32px", clipPath: "inset(0 round 32px)" }}
        priority
      />
    </div>
  )
}

export default McpConnectivityIllustration
