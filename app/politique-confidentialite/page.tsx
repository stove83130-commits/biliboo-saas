import { Header } from "@/components/sections/header"
import { FooterSection } from "@/components/sections/footer-section"

export const metadata = {
  title: "Politique de Confidentialité - Bilibou",
  description: "Politique de confidentialité de Bilibou"
}

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="w-full max-w-[1320px] mx-auto px-4 lg:px-6 pt-4">
        <Header />
      </div>
      <div className="max-w-4xl mx-auto px-5 py-12 md:py-20">
        <h1 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
          Politique de confidentialité
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Dernière mise à jour : 29 octobre 2025
        </p>
        
        <div className="prose prose-gray max-w-none text-foreground/90 space-y-6">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              1. Introduction
            </h2>
            <p>
              La présente Politique de confidentialité décrit la manière dont vos informations personnelles sont collectées, utilisées et protégées lorsque vous utilisez le site www.bilibou.com (le « Site ») ou les services proposés par Bilibou.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              2. Informations personnelles recueillies
            </h2>
            
            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
              a) Données collectées automatiquement
            </h3>
            <p>
              Lorsque vous visitez le Site, nous recueillons automatiquement certaines informations techniques :
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>type et version du navigateur,</li>
              <li>adresse IP,</li>
              <li>fuseau horaire,</li>
              <li>pages consultées,</li>
              <li>origine de la visite (site référent ou recherche),</li>
              <li>données de navigation et cookies.</li>
            </ul>
            <p className="mt-4">
              Ces données servent à améliorer le fonctionnement et la sécurité du Site.
            </p>

            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
              b) Données fournies lors de la création de compte ou d'un abonnement
            </h3>
            <p>
              Lors de l'inscription ou de la souscription à un abonnement, nous collectons :
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>nom, prénom,</li>
              <li>adresse e-mail,</li>
              <li>adresse postale (si demandée pour facturation),</li>
              <li>numéro de téléphone (facultatif),</li>
              <li>informations de paiement (gérées de manière sécurisée par Stripe, prestataire agréé PCI-DSS).</li>
            </ul>
            <p className="mt-4">
              Ces informations sont nécessaires pour la gestion du compte, la facturation et la fourniture du service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              3. Technologies de suivi utilisées
            </h2>
            <p>
              Nous utilisons des cookies et technologies similaires pour :
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>assurer le bon fonctionnement du site (session, authentification),</li>
              <li>mesurer la fréquentation (via Google Analytics),</li>
              <li>améliorer l'expérience utilisateur.</li>
            </ul>
            <p className="mt-4">
              Vous pouvez gérer vos préférences cookies à tout moment depuis la bannière d'acceptation affichée lors de votre première visite.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              4. Utilisation des informations
            </h2>
            <p>
              Les données personnelles sont utilisées pour :
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>créer et gérer les comptes utilisateurs ;</li>
              <li>permettre l'accès au service SaaS ;</li>
              <li>traiter les paiements et la facturation ;</li>
              <li>communiquer avec les utilisateurs (support, notifications) ;</li>
              <li>analyser les performances du Site et prévenir la fraude.</li>
            </ul>
            <p className="mt-4">
              Aucune donnée n'est vendue ni utilisée à des fins publicitaires externes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              5. Partage des informations
            </h2>
            <p>
              Vos données peuvent être transmises à nos prestataires techniques :
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>Vercel Inc. – hébergement du site (<a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://vercel.com</a>) ;</li>
              <li>Supabase Inc. – base de données et authentification ;</li>
              <li>Stripe Payments Europe Ltd. – traitement sécurisé des paiements ;</li>
              <li>Google LLC – analytique (Google Analytics).</li>
            </ul>
            <p className="mt-4">
              Ces partenaires agissent en sous-traitants, conformément au RGPD, et ne traitent les données qu'aux fins du service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              6. Conservation des données
            </h2>
            <p>
              Les données sont conservées tant que le compte utilisateur est actif. Elles peuvent être supprimées sur simple demande à <a href="mailto:contact@bilibou.com" className="text-primary hover:underline">contact@bilibou.com</a>.
            </p>
            <p className="mt-4">
              Les données de facturation peuvent être conservées jusqu'à 10 ans conformément aux obligations comptables françaises.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              7. Sécurité
            </h2>
            <p>
              Les données sont stockées sur des serveurs sécurisés (hébergés par Vercel et Supabase) avec chiffrement des échanges via HTTPS. Des mesures de sécurité logiques et organisationnelles sont mises en place pour éviter tout accès non autorisé.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              8. Droits des utilisateurs
            </h2>
            <p>
              Conformément au RGPD, vous disposez des droits suivants :
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>droit d'accès et de rectification de vos données ;</li>
              <li>droit à l'effacement (« droit à l'oubli ») ;</li>
              <li>droit à la portabilité ;</li>
              <li>droit d'opposition et de limitation du traitement.</li>
            </ul>
            <p className="mt-4">
              Toute demande peut être adressée à <a href="mailto:contact@bilibou.com" className="text-primary hover:underline">contact@bilibou.com</a>. Les demandes sont traitées dans un délai maximum de 30 jours.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              9. Transfert hors UE
            </h2>
            <p>
              Certains de nos prestataires (notamment Vercel et Supabase) sont situés aux États-Unis. Des clauses contractuelles types de la Commission européenne encadrent ces transferts pour garantir la conformité au RGPD.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              10. Mineurs
            </h2>
            <p>
              Le Site et les services ne sont pas destinés aux personnes de moins de 16 ans. Aucune donnée personnelle n'est sciemment collectée auprès de mineurs.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              11. Modifications
            </h2>
            <p>
              Cette politique pourra être mise à jour en cas d'évolution légale ou technique. La dernière version est toujours disponible sur le site www.bilibou.com.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              12. Contact
            </h2>
            <p>
              Pour toute question relative à la confidentialité ou pour exercer vos droits :
            </p>
            <ul className="list-none ml-4 space-y-2 mt-4">
              <li>Email : <a href="mailto:contact@bilibou.com" className="text-primary hover:underline">contact@bilibou.com</a></li>
              <li>Adresse postale : 126 rue André Vuillet, 83100 Toulon, France</li>
            </ul>
          </section>
        </div>
      </div>
      <FooterSection />
    </div>
  )
}

