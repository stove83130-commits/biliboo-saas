import type React from "react"
import Image from "next/image"

const AiCodeReviews: React.FC = () => {
  return (
    <div className="w-full h-full relative">
      <Image
        src="/features/extraction-gmail-outlook.webp/Design sans titre (24).png"
        alt="Extraction automatique depuis Gmail/Outlook"
        fill
        className="object-contain scale-100 md:scale-115"
        style={{
          borderRadius: "32px",
          clipPath: "inset(0 round 32px)",
          WebkitClipPath: "inset(0 round 32px)",
        }}
        priority
      />
    </div>
  )
}

export default AiCodeReviews
