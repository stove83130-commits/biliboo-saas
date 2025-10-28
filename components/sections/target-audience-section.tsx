const audiences = [
  {
    icon: "user",
    title: "Freelances & Indépendants",
    description: "Centralisez automatiquement toutes vos factures dans un seul espace",
    benefit: "plus de sérénité et moins de stress administratif",
  },
  {
    icon: "building",
    title: "TPE & PME",
    description: "Réduisez de 50 % le temps et le coût de gestion de vos factures",
    benefit: "plus de contrôle et de visibilité sur vos finances",
  },
  {
    icon: "chart",
    title: "Cabinets comptables",
    description: "Recevez les factures de vos clients déjà classées et prêtes à l'export",
    benefit: "plus de fluidité dans vos process et moins de perte de temps",
  },
  {
    icon: "enterprise",
    title: "Grandes Entreprises & ETI",
    description: "Intégrez facilement vos flux de factures via Gmail et Outlook",
    benefit: "plus d'agilité et une meilleure collaboration inter-équipes",
  },
]

const IconWrapper = ({ type }: { type: string }) => {
  const icons = {
    user: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    building: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M3 21H21M3 7L12 3L21 7M5 21V10M19 21V10M9 21V14H15V21M9 10H10M14 10H15M9 14H10M14 14H15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    chart: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M3 3V21H21M7 16L12 11L16 15L21 10M21 10V14M21 10H17"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    enterprise: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M3 21H21M4 7H20M4 7V21M20 7V21M8 11H10M8 15H10M14 11H16M14 15H16M12 3L4 7M12 3L20 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  }
  return <div className="text-primary">{icons[type as keyof typeof icons]}</div>
}

const AudienceCard = ({
  icon,
  title,
  description,
  benefit,
}: {
  icon: string
  title: string
  description: string
  benefit: string
}) => {
  return (
    <div className="flex flex-col justify-start items-start gap-4 p-8 bg-card rounded-[10px] shadow-[0px_2px_4px_rgba(0,0,0,0.08)] outline outline-1 outline-border outline-offset-[-1px] w-full h-full">
      <div className="flex items-center gap-3">
        <IconWrapper type={icon} />
        <h3 className="text-foreground text-lg font-normal leading-7">{title}</h3>
      </div>
      <p className="text-muted-foreground text-lg font-normal leading-7">{description}</p>
      <div className="flex items-start gap-2 pt-2">
        <span className="text-primary text-sm font-semibold">Bénéfice :</span>
        <p className="text-muted-foreground text-sm font-normal leading-relaxed">{benefit}</p>
      </div>
    </div>
  )
}

export function TargetAudienceSection() {
  return (
    <section className="w-full px-5 overflow-hidden flex flex-col justify-start py-6 md:py-8 lg:py-14 relative mb-16 md:mb-24">
      <div className="w-[400px] h-[700px] absolute top-[200px] left-[50px] origin-top-left rotate-[-25deg] bg-primary/10 blur-[130px] z-0" />
      <div className="w-[350px] h-[600px] absolute top-[300px] right-[100px] origin-top-right rotate-[30deg] bg-primary/8 blur-[120px] z-0" />

      <div className="self-stretch py-6 md:py-8 lg:py-14 flex flex-col justify-center items-center gap-2 relative z-10">
        <div className="flex flex-col justify-start items-center gap-4">
          <h2 className="text-center text-foreground text-3xl md:text-4xl lg:text-[40px] font-semibold leading-tight md:leading-tight lg:leading-[40px]">
            Pour qui est fait Bilibou ?
          </h2>
          <p className="self-stretch text-center text-muted-foreground text-sm md:text-sm lg:text-base font-medium leading-[18.20px] md:leading-relaxed lg:leading-relaxed max-w-2xl">
            Une solution adaptée à tous les profils, du freelance à la grande entreprise
          </p>
        </div>
      </div>
      <div className="w-full pt-0.5 pb-4 md:pb-6 lg:pb-10 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-4 lg:gap-6 max-w-[1200px] mx-auto relative z-10">
        {audiences.map((audience, index) => (
          <AudienceCard key={index} {...audience} />
        ))}
      </div>
    </section>
  )
}
