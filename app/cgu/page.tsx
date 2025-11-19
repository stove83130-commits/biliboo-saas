"use client"

import { Header } from "@/components/sections/header"
import { FooterSection } from "@/components/sections/footer-section"

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="w-full max-w-[1320px] mx-auto px-4 lg:px-6 pt-4">
        <Header />
      </div>
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <h1 className="text-3xl md:text-4xl font-semibold mb-2">Conditions Générales d'Utilisation</h1>
          <p className="text-sm text-muted-foreground mb-8">En vigueur au 30/10/2025</p>

          <div className="prose prose-neutral max-w-none prose-h2:mt-10 prose-h3:mt-6 prose-p:leading-relaxed">
            <p>
              Les présentes conditions générales d'utilisation (dites « CGU ») ont pour objet l'encadrement juridique des modalités de mise à disposition du site et des services par Noa Bordonado et de définir les conditions d'accès et d'utilisation des services par « l'Utilisateur ».
            </p>
            <p>Les présentes CGU sont accessibles sur le site à la rubrique « CGU ».</p>
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
            <p>L'édition et la direction de la publication du site bilibou.com est assurée par :</p>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <div>
                <dt className="font-medium">Nom</dt>
                <dd>Noa Bordonado</dd>
              </div>
              <div>
                <dt className="font-medium">Statut juridique</dt>
                <dd>Micro-entreprise</dd>
              </div>
              <div>
                <dt className="font-medium">SIRET</dt>
                <dd>992 767 798 00018</dd>
              </div>
              <div>
                <dt className="font-medium">Adresse du siège</dt>
                <dd>126 rue André Vuillet, 83100 Toulon, France</dd>
              </div>
              <div>
                <dt className="font-medium">Téléphone</dt>
                <dd>06 28 81 30 52</dd>
              </div>
              <div>
                <dt className="font-medium">Email</dt>
                <dd>stove83130@gmail.com</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="font-medium">Directeur de publication</dt>
                <dd>Noa Bordonado</dd>
              </div>
            </dl>
            <p>
              L'hébergeur du site bilibou.com est la société Vercel Inc., dont le siège social est situé au 440 N Barranca Avenue, #4133, Covina, CA 91723, États-Unis.
            </p>
            <p>
              Contact hébergeur : <a href="https://vercel.com/contact" target="_blank" rel="noreferrer">https://vercel.com/contact</a>
            </p>

            <h2>ARTICLE 2 : Accès au site</h2>
            <p>
              Le site bilibou.com permet à l'Utilisateur un accès aux services suivants : un service en ligne (SaaS) d'automatisation et de gestion (factures, reçus, etc.). Accès via interface web sécurisée, avec création de compte et abonnement.
            </p>
            <p>
              Le site est accessible en tout lieu à tout Utilisateur ayant un accès à Internet. Tous les frais (matériel, logiciels, connexion) sont à la charge de l'Utilisateur.
            </p>

            <h3>2.1 Inscription et compte utilisateur</h3>
            <p>L'Utilisateur non membre doit créer un compte pour accéder aux services réservés.</p>
            <ul>
              <li>Inscription par formulaire (email et mot de passe)</li>
              <li>Inscription via Google OAuth</li>
              <li>Inscription via Microsoft OAuth</li>
            </ul>
            <p>Les informations fournies doivent être sincères et exactes.</p>

            <h3>2.2 Authentification via fournisseurs tiers (OAuth)</h3>
            <h4>Authentification via Google</h4>
            <ul>
              <li>Nom, prénom, email, photo de profil (si disponible), identifiant Google unique</li>
              <li>Politique Google : <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">policies.google.com/privacy</a></li>
              <li>Révocation : <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a></li>
            </ul>
            <h4>Authentification via Microsoft</h4>
            <ul>
              <li>Nom, prénom, email, photo de profil (si disponible), identifiant Microsoft unique</li>
              <li>Politique Microsoft : <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noreferrer">privacy.microsoft.com/privacystatement</a></li>
              <li>Révocation : <a href="https://account.microsoft.com/privacy" target="_blank" rel="noreferrer">account.microsoft.com/privacy</a></li>
            </ul>
            <p className="italic">
              bilibou.com ne collecte que les informations strictement nécessaires et ne gère pas l'authentification des fournisseurs tiers.
            </p>

            <h3>2.3 Connexion au compte</h3>
            <p>Connexion via email/mot de passe ou compte Google/Microsoft.</p>

            <h3>2.4 Abonnements</h3>
            <p>Voir les CGV pour les tarifs, paiements et résiliation.</p>

            <h3>2.5 Désinscription</h3>
            <ul>
              <li>Via l'espace personnel ou courriel à contact@bilibou.com</li>
              <li>Suppression sous 30 jours (données de facturation conservées 10 ans)</li>
              <li>La suppression du compte bilibou.com n'affecte pas les comptes Google/Microsoft</li>
            </ul>

            <h3>2.6 Disponibilité du service</h3>
            <p>Service 24/7 hors maintenance, force majeure ou incidents techniques.</p>

            <h2>ARTICLE 3 : Collecte et traitement des données personnelles</h2>
            <ul>
              <li><strong>Responsable</strong> : Noa Bordonado – contact@bilibou.com – 126 rue André Vuillet, 83100 Toulon</li>
              <li><strong>Cadre</strong> : RGPD et Loi Informatique et Libertés</li>
              <li><strong>Finalités</strong> : compte, authentification, service, facturation, amélioration, obligations légales</li>
              <li><strong>Droits</strong> : accès, rectification, effacement, opposition, limitation, portabilité – via contact@bilibou.com</li>
              <li><strong>CNIL</strong> : www.cnil.fr – 3 Place de Fontenoy – 75334 PARIS CEDEX 07 – 01 53 73 22 22</li>
            </ul>

            <h2>ARTICLE 4 : Propriété intellectuelle</h2>
            <p>Contenus protégés. Toute reproduction nécessite autorisation.</p>

            <h2>ARTICLE 5 : Responsabilité</h2>
            <ul>
              <li>Informations indicatives, sans valeur contractuelle</li>
              <li>Pas de responsabilité en cas de force majeure ou d'interruptions tiers (Google/Microsoft)</li>
              <li>Responsabilité de l'Utilisateur quant à l'usage de ses identifiants et des données intégrées</li>
            </ul>

            <h2>ARTICLE 6 : Liens hypertextes</h2>
            <p>Les liens externes sortent du site ; bilibou.com n'en contrôle pas le contenu.</p>

            <h2>ARTICLE 7 : Cookies et traceurs</h2>
            <ul>
              <li>Cookies essentiels (authentification, sécurité, préférences)</li>
              <li>Cookies non essentiels (analyse, performance) soumis au consentement</li>
              <li>Gestion via bandeau et préférences navigateur</li>
            </ul>

            <h2>ARTICLE 8 : Droit applicable et juridiction compétente</h2>
            <p>Droit français. Litiges : tentative amiable puis juridictions françaises compétentes.</p>

            <h2>ARTICLE 9 : Contact</h2>
            <p>contact@bilibou.com – 126 rue André Vuillet, 83100 Toulon, France – 06 28 81 30 52</p>

            <h3>Acceptation des CGU</h3>
            <p>En utilisant le site bilibou.com, l'Utilisateur reconnaît avoir lu, compris et accepté l'intégralité des présentes CGU.</p>
            <p className="text-sm text-muted-foreground">Date de dernière mise à jour : 30/10/2025</p>
          </div>
        </div>
      </main>
      <FooterSection />
    </div>
  )
}


