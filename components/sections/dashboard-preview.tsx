import Image from "next/image"

export function DashboardPreview() {
  return (
    <section className="w-full px-5 flex flex-col justify-center items-center -mt-36 md:-mt-52 lg:-mt-64 relative z-30">
      <div className="w-full max-w-[1400px] mx-auto">
        <div className="bg-primary-light/50 rounded-2xl p-2 shadow-2xl">
          <Image
            src="/cioucioute.png"
            alt="Dashboard preview"
            width={1400}
            height={850}
            className="w-full h-auto object-cover rounded-xl shadow-lg"
            priority
          />
        </div>
      </div>
    </section>
  )
}
