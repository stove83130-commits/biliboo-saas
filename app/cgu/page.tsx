"use client"

import { FooterSection } from "@/components/sections/footer-section"

export default function CGUPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-semibold mb-2">Conditions Générales d'Utilisation</h1>
          <p className="text-sm text-muted-foreground mb-8">En vigueur au 30/10/2025</p>

          <div className="prose prose-neutral max-w-none">
            <p>
              Les présentes conditions générales d'utilisation (dites « CGU ») ont pour objet l'encadrement juridique des modalités de mise à disposition du site et des services par Noa Bordonado et de définir les conditions d'accès et d'utilisation des services par « l'Utilisateur ».
            </p>
            <p>
              Les présentes CGU sont accessibles sur le site à la rubrique « CGU ».
            </p>
            <p>
              Toute inscription ou utilisation du site implique l'acceptation sans aucune réserve ni restriction des présentes CGU par l'utilisateur. Lors de l'inscription sur le site, chaque utilisateur accepte expressément les présentes CGU en cochant la case précédant le texte suivant : « Je reconnais avoir lu et compris les CGU et je les accepte ».
            </p>
            <p>
              En cas de non-acceptation des CGU stipulées dans le présent contrat, l'Utilisateur se doit de renoncer à l'accès des services proposés par le site.
            </p>
            <p>
              bilibou.com se réserve le droit de modifier unilatéralement et à tout moment le contenu des présentes CGU. Les Utilisateurs seront informés de toute modification par email ou via une notification sur le site.
            </p>

            <h2>ARTICLE 1 : Mentions légales</h2>
            <p>
              L'édition et la direction de la publication du site bilibou.com est assurée par :
            </p>
            <p>
              <strong>Nom</strong> : Noa Bordonado<br/>
              <strong>Statut juridique</strong> : [Auto-entrepreneur / Micro-entreprise / SASU / EURL - à compléter]<br/>
              <strong>SIRET</strong> : 992 767 798 00018<br/>
              <strong>Adresse du siège</strong> : 126 rue André Vuillet, 83100 Toulon, France<br/>
              <strong>Téléphone</strong> : 06 28 81 30 52<br/>
              <strong>Email</strong> : stove83130@gmail.com<br/>
              <strong>Directeur de publication</strong> : Noa Bordonado
            </p>
            <p>
              L'hébergeur du site bilibou.com est la société Vercel Inc., dont le siège social est situé au 440 N Barranca Avenue, #4133, Covina, CA 91723, États-Unis.
            </p>
            <p>
              Contact hébergeur : <a href="https://vercel.com/contact" target="_blank" rel="noreferrer">https://vercel.com/contact</a>
            </p>

            <h2>ARTICLE 2 : Accès au site</h2>
            <p>
              Le site bilibou.com permet à l'Utilisateur un accès aux services suivants :
            </p>
            <p>
              Le site bilibou.com propose un service en ligne (SaaS) permettant l'automatisation et la gestion de tâches administratives et professionnelles, notamment la gestion de factures et de reçus. Les utilisateurs peuvent créer un compte, souscrire à un abonnement et accéder aux fonctionnalités offertes par la plateforme via une interface web sécurisée.
            </p>
            <p>
              Le site est accessible en tout lieu à tout Utilisateur ayant un accès à Internet. Tous les frais supportés par l'Utilisateur pour accéder au service (matériel informatique, logiciels, connexion Internet, etc.) sont à sa charge.
            </p>

            <h3>2.1 Inscription et compte utilisateur</h3>
            <p>
              L'Utilisateur non membre n'a pas accès aux services réservés. Pour cela, il doit s'inscrire en créant un compte.
            </p>
            <p>
              Méthodes d'inscription disponibles :
            </p>
            <ul>
              <li>Inscription par formulaire (email et mot de passe)</li>
              <li>Inscription via Google OAuth</li>
              <li>Inscription via Microsoft OAuth</li>
            </ul>
            <p>
              En acceptant de s'inscrire aux services réservés, l'Utilisateur membre s'engage à fournir des informations sincères et exactes concernant son identité et ses coordonnées, notamment son adresse email.
            </p>

            <h3>2.2 Authentification via fournisseurs tiers (OAuth)</h3>
            <p>
              Le site propose une authentification via des fournisseurs d'identité tiers : Google et Microsoft.
            </p>
            <h4>Authentification via Google</h4>
            <p>
              En utilisant l'option de connexion via Google OAuth, l'Utilisateur autorise bilibou.com à recevoir de Google les informations suivantes : Nom et prénom, Adresse email, Photo de profil (si disponible), Identifiant Google unique.
            </p>
            <p>
              Ces données sont transmises par Google conformément à leur politique de confidentialité : <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">https://policies.google.com/privacy</a>
            </p>
            <p>
              L'Utilisateur peut révoquer l'accès via : <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">https://myaccount.google.com/permissions</a>
            </p>

            <h4>Authentification via Microsoft</h4>
            <p>
              En utilisant l'option de connexion via Microsoft OAuth, l'Utilisateur autorise bilibou.com à recevoir de Microsoft les informations suivantes : Nom et prénom, Adresse email, Photo de profil (si disponible), Identifiant Microsoft unique.
            </p>
            <p>
              Politique de confidentialité Microsoft : <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noreferrer">https://privacy.microsoft.com/privacystatement</a>
            </p>
            <p>
              Révocation des autorisations : <a href="https://account.microsoft.com/privacy" target="_blank" rel="noreferrer">https://account.microsoft.com/privacy</a>
            </p>

            <h3>2.3 Connexion au compte</h3>
            <p>
              Pour accéder aux services, l'Utilisateur doit s'identifier à l'aide de son email/mot de passe ou de son compte Google/Microsoft.
            </p>

            <h3>2.4 Abonnements</h3>
            <p>
              Les conditions tarifaires et de résiliation sont détaillées dans les CGV disponibles sur le site.
            </p>

            <h3>2.5 Désinscription</h3>
            <p>
              L'Utilisateur peut demander la suppression de son compte via son espace personnel ou par email à contact@bilibou.com. La suppression est définitive sous 30 jours (données de facturation conservées 10 ans).
            </p>

            <h3>2.6 Disponibilité du service</h3>
            <p>
              Service 24/7 hors maintenance et cas de force majeure.
            </p>

            <h2>ARTICLE 3 : Collecte et traitement des données personnelles</h2>
            <p>
              Responsable de traitement : Noa Bordonado – contact@bilibou.com – 126 rue André Vuillet, 83100 Toulon, France.
            </p>
            <p>
              Cadre juridique : RGPD et Loi Informatique et Libertés.
            </p>
            <p>
              Données collectées selon le mode d'inscription et l'utilisation. Finalités : création de compte, authentification, fourniture du service, facturation, amélioration, obligations légales.
            </p>
            <p>
              Droits RGPD (accès, rectification, effacement, opposition, limitation, portabilité) via contact@bilibou.com. Réclamation possible auprès de la CNIL.
            </p>

            <h2>ARTICLE 4 : Propriété intellectuelle</h2>
            <p>
              Les contenus du site sont protégés. Toute reproduction nécessite autorisation.
            </p>

            <h2>ARTICLE 5 : Responsabilité</h2>
            <p>
              Informations indicatives sans valeur contractuelle. Aucune responsabilité en cas de force majeure, d'interruptions tiers (Google/Microsoft) ou d'usages non conformes.
            </p>

            <h2>ARTICLE 6 : Liens hypertextes</h2>
            <p>
              Les liens externes sortent du site ; bilibou.com n'en contrôle pas le contenu.
            </p>

            <h2>ARTICLE 7 : Cookies et traceurs</h2>
            <p>
              Cookies essentiels pour l'authentification et non essentiels soumis au consentement.
            </p>

            <h2>ARTICLE 8 : Droit applicable et juridiction compétente</h2>
            <p>
              Droit français. Litiges : tentative amiable puis juridictions françaises compétentes.
            </p>

            <h2>ARTICLE 9 : Contact</h2>
            <p>
              contact@bilibou.com – 126 rue André Vuillet, 83100 Toulon, France – 06 28 81 30 52
            </p>

            <h3>Acceptation des CGU</h3>
            <p>
              En utilisant le site bilibou.com, l'Utilisateur reconnaît avoir lu, compris et accepté l'intégralité des présentes CGU.
            </p>
            <p className="text-sm text-muted-foreground">Date de dernière mise à jour : 30/10/2025</p>
          </div>
        </div>
      </main>
      <FooterSection />
    </div>
  )
}


