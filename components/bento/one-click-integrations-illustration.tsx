import Image from "next/image"
import type React from "react"

interface OneClickIntegrationsIllustrationProps {
  className?: string
}

const OneClickIntegrationsIllustration: React.FC<OneClickIntegrationsIllustrationProps> = ({ className = "" }) => {
  return (
    <div className={`w-full h-full relative ${className}`}>
      <Image
        src="/features/dashboard-statistiques.png/Design sans titre (24).png"
        alt="Dashboard avec statistiques visuelles"
        fill
        className="object-contain"
        style={{ borderRadius: "32px", clipPath: "inset(0 round 32px)" }}
        priority
      />
    </div>
  )
}

export default OneClickIntegrationsIllustration