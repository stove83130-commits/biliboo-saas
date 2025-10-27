import Image from "next/image"

export function SocialProof() {
  return (
    <section className="self-stretch py-16 flex flex-col justify-center items-center gap-6 overflow-hidden">
      <div className="text-center text-muted-foreground text-sm font-bold leading-tight">
        Intégré aux outils que vous utilisez déjà
      </div>
      <div className="self-stretch grid grid-cols-2 md:grid-cols-4 gap-8 justify-items-center">
        {[
          "ChatGPT Image 5 oct. 2025, 18_53_27.png",
          "ChatGPT Image 5 oct. 2025, 18_54_28.png",
          "ChatGPT Image 5 oct. 2025, 18_55_02.png",
          "ChatGPT Image 5 oct. 2025, 18_55_40.png",
        ].map((filename, i) => (
          <Image
            key={filename}
            src={`/logos/${filename}`}
            alt={`Logo ${i + 1}`}
            width={240}
            height={80}
            className="w-full max-w-[180px] h-auto object-contain grayscale opacity-70"
          />
        ))}
      </div>
    </section>
  )
}
