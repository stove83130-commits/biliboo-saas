import { Header } from "@/components/sections/header"
import { FooterSection } from "@/components/sections/footer-section"

export const metadata = {
  title: "Mentions Légales - Bilibou",
  description: "Mentions légales de Bilibou"
}

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="w-full max-w-[1320px] mx-auto px-4 lg:px-6 pt-4">
        <Header />
      </div>
      <div className="max-w-4xl mx-auto px-5 py-12 md:py-20">
        <h1 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
          Mentions légales
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          En vigueur au 29/10/2025
        </p>
        
        <div className="prose prose-gray max-w-none text-foreground/90 space-y-6">
          <p>
            Conformément aux dispositions de la loi n°2004-575 du 21 juin 2004 pour la Confiance en l'économie numérique, il est porté à la connaissance des utilisateurs et visiteurs, ci-après l' "Utilisateur", du site bilibou.com, ci-après le "Site", les présentes mentions légales.
          </p>
          
          <p>
            La connexion et la navigation sur le Site par l'Utilisateur implique acceptation intégrale et sans réserve des présentes mentions légales.
          </p>
          
          <p>
            Ces dernières sont accessibles sur le Site à la rubrique "Mentions légales".
          </p>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              ÉDITION DU SITE
            </h2>
            <p>
              L'édition du Site est assurée par la société BORDONADO NOA, Entreprise individuelle au capital de 0 euros, immatriculée au Registre du Commerce et des Sociétés de Toulon sous le numéro 992767798 dont le siège social est situé au 126 rue andre vuillet 83100,
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Numéro de téléphone : 0628813052</li>
              <li>Adresse e-mail : stove83130@gmail.com</li>
              <li>N° de TVA intracommunautaire : FR80992767798</li>
              <li>Directeur de la publication : Bordonado Noa</li>
            </ul>
            <p className="mt-4">
              ci-après l'"Editeur".
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              HÉBERGEUR
            </h2>
            <p>
              L'hébergeur du Site est la société Vercel Inc, dont le siège social est situé au 440 N Barranca Avenue #4133 91723 Covina.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              ACCÈS AU SITE
            </h2>
            <p>
              Le Site est normalement accessible, à tout moment, à l'Utilisateur. Toutefois, l'Editeur pourra, à tout moment, suspendre, limiter ou interrompre le Site afin de procéder, notamment, à des mises à jour ou des modifications de son contenu. L'Editeur ne pourra en aucun cas être tenu responsable des conséquences éventuelles de cette indisponibilité sur les activités de l'Utilisateur.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              COLLECTE DES DONNÉES
            </h2>
            <p>
              Le Site assure à l'Utilisateur une collecte et un traitement des données personnelles dans le respect de la vie privée conformément à la loi n°78-17 du 6 janvier 1978 relative à l'informatique, aux fichiers aux libertés et dans le respect de la règlementation applicable en matière de traitement des données à caractère personnel conformément au règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 (ci-après, ensemble, la "Règlementation applicable en matière de protection des Données à caractère personnel").
            </p>
            <p className="mt-4">
              En vertu de la Règlementation applicable en matière de protection des Données à caractère personnel, l'Utilisateur dispose d'un droit d'accès, de rectification, de suppression et d'opposition de ses données personnelles. L'Utilisateur peut exercer ce droit :
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>par mail à l'adresse email contact@bilibou.com</li>
              <li>depuis son espace personnel ;</li>
            </ul>
          </section>

          <section>
            <p className="mt-8">
              Toute utilisation, reproduction, diffusion, commercialisation, modification de toute ou partie du Site, sans autorisation expresse de l'Editeur est prohibée et pourra entraîner des actions et poursuites judiciaires telles que prévues par la règlementation en vigueur.
            </p>
            <p className="mt-4">
              Pour plus d'informations, se reporter aux CGV du site bilibou.com accessibles depuis la rubrique "CGV".
            </p>
            <p className="mt-2">
              Pour plus d'informations en matière de protection des données à caractère personnel, se reporter à la Charte en matière de protection des données à caractère personnel du site bilibou.com accessible depuis la rubrique "Données personnelles".
            </p>
          </section>

          <p className="text-sm text-muted-foreground mt-8">
            Rédigé sur http://legalplace.fr
          </p>
        </div>
      </div>
      <FooterSection />
    </div>
  )
}

