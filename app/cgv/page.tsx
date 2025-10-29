import { Header } from "@/components/sections/header"
import { FooterSection } from "@/components/sections/footer-section"

export const metadata = {
  title: "Conditions Générales de Vente - Bilibou",
  description: "Conditions Générales de Vente de Bilibou"
}

export default function CGVPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="w-full max-w-[1320px] mx-auto px-4 lg:px-6 pt-4">
        <Header />
      </div>
      <div className="max-w-4xl mx-auto px-5 py-12 md:py-20">
        <h1 className="text-3xl md:text-4xl font-semibold text-foreground mb-4">
          CONDITIONS GÉNÉRALES DE VENTE – INTERNET
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          En vigueur au 29/10/2025
        </p>
        
        <div className="prose prose-gray max-w-none text-foreground/90 space-y-6">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              ARTICLE 1 - Champ d'application
            </h2>
            <p>
              Les présentes Conditions Générales de Vente (dites « CGV ») s'appliquent, sans restriction ni réserve à tout achat des services de suivants :
            </p>
            <p className="mt-4">
              Prestations d'abonnement à un logiciel en ligne (SaaS) permettant la gestion et l'automatisation de processus administratifs (factures/reçus) tels que proposés par le Prestataire aux clients non professionnels (« Les Clients ou le Client ») sur le site bilibou.com.
            </p>
            <p className="mt-4">
              Les caractéristiques principales des Services sont présentées sur le site internet bilibou.com. Le Client est tenu d'en prendre connaissance avant toute passation de commande. Le choix et l'achat d'un Service est de la seule responsabilité du Client.
            </p>
            <p className="mt-4">
              Ces CGV sont accessibles à tout moment sur le site bilibou.com et prévaudront sur toute autre document.
            </p>
            <p className="mt-4">
              Le Client déclare avoir pris connaissance des présentes CGV et les avoir acceptées en cochant la case prévue à cet effet avant la mise en oeuvre de la procédure de commande en ligne du site bilibou.com.
            </p>
            <p className="mt-4">
              Sauf preuve contraire, les données enregistrées dans le système informatique du Prestataire constituent la preuve de l'ensemble des transactions conclues avec le Client.
            </p>
            <p className="mt-4">
              Les coordonnées du Prestataire sont les suivantes :
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>noa Bordonado</li>
              <li>126 rue andre vuillet 83100</li>
              <li>Numéro d'immatriculation : _______________</li>
              <li>mail : stove83130@gmail.com</li>
              <li>téléphone : 0628813052</li>
            </ul>
            <p className="mt-4">
              Des droits de douane ou autres taxes locales ou droits d'importation ou taxes d'état sont susceptibles d'être exigibles. Ils seront à la charge et relèvent de la seule responsabilité du Client.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              ARTICLE 2 - Prix
            </h2>
            <p>
              Les Services sont fournis aux tarifs en vigueur figurant sur le site bilibou.com, lors de l'enregistrement de la commande par le Prestataire.
            </p>
            <p className="mt-4">
              Les prix sont exprimés en Euros, HT et TTC. Les tarifs tiennent compte d'éventuelles réductions qui seraient consenties par le Prestataire sur le site bilibou.com.
            </p>
            <p className="mt-4">
              Ces tarifs sont fermes et non révisables pendant leur période de validité mais le Prestataire se réserve le droit, hors période de validité, d'en modifier les prix à tout moment.
            </p>
            <p className="mt-4">
              Les prix ne comprennent pas les frais de traitement, d'expédition, de transport et de livraison, qui sont facturés en supplément, dans les conditions indiquées sur le site et calculés préalablement à la passation de la commande.
            </p>
            <p className="mt-4">
              Le paiement demandé au Client correspond au montant total de l'achat, y compris ces frais.
            </p>
            <p className="mt-4">
              Une facture est établie par le Prestataire et remise au Client lors de la fourniture des Services commandés.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              ARTICLE 3 – Commandes
            </h2>
            <p>
              Il appartient au Client de sélectionner sur le site bilibou.com les Services qu'il désire commander, selon les modalités suivantes :
            </p>
            <p className="mt-4">
              Le Client sélectionne l'offre d'abonnement souhaitée sur le site, crée un compte ou se connecte à son espace client, puis procède au paiement sécurisé en ligne via la plateforme de paiement. Après confirmation du règlement, le Client reçoit un email de confirmation et obtient un accès immédiat au service SaaS bilibou.com selon la formule choisie.
            </p>
            <p className="mt-4">
              La vente ne sera considérée comme valide qu'après paiement intégral du prix. Il appartient au Client de vérifier l'exactitude de la commande et de signaler immédiatement toute erreur.
            </p>
            <p className="mt-4">
              Toute commande passée sur le site bilibou.com constitue la formation d'un contrat conclu à distance entre le Client et le Prestataire.
            </p>
            <p className="mt-4">
              Le Prestataire se réserve le droit d'annuler ou de refuser toute commande d'un Client avec lequel il existerait un litige relatif au paiement d'une commande antérieure.
            </p>
            <p className="mt-4">
              Le Client pourra suivre l'évolution de sa commande sur le site.
            </p>
            <p className="mt-4">
              La passation d'une commande sur le site bilibou.com implique la conclusion d'un contrat d'une durée minimum. Le contrat est tacitement renouvelé par périodes successives d'un mois pour les abonnements mensuels, et d'un an pour les abonnements annuels, à la date anniversaire de la souscription, renouvelable pour une même durée par tacite reconduction.
            </p>
            <p className="mt-4">
              Aux termes de l'article L 215-1 du Code de la consommation, reproduit ci-dessous :
            </p>
            <blockquote className="border-l-4 border-primary pl-4 my-4 italic">
              "Pour les contrats de prestations de services conclus pour une durée déterminée avec une clause de reconduction tacite, le professionnel prestataire de services informe le consommateur par écrit, par lettre nominative ou courrier électronique dédiés, au plus tôt trois mois et au plus tard un mois avant le terme de la période autorisant le rejet de la reconduction, de la possibilité de ne pas reconduire le contrat qu'il a conclu avec une clause de reconduction tacite. Cette information, délivrée dans des termes clairs et compréhensibles, mentionne, dans un encadré apparent, la date limite de non-reconduction.
            </blockquote>
            <blockquote className="border-l-4 border-primary pl-4 my-4 italic">
              Lorsque cette information ne lui a pas été adressée conformément aux dispositions du premier alinéa, le consommateur peut mettre gratuitement un terme au contrat, à tout moment à compter de la date de reconduction. Les avances effectuées après la dernière date de reconduction ou, s'agissant des contrats à durée indéterminée, après la date de transformation du contrat initial à durée déterminée, sont dans ce cas remboursées dans un délai de trente jours à compter de la date de résiliation, déduction faite des sommes correspondant, jusqu'à celle-ci, à l'exécution du contrat. Les dispositions du présent article s'appliquent sans préjudice de celles qui soumettent légalement certains contrats à des règles particulières en ce qui concerne l'information du consommateur. »
            </blockquote>
            <p className="mt-4">
              L'article L215-2 du Code de la consommation exclut l'application de l'art L215-1 aux exploitants des services d'eau potable et d'assainissement, à l'inverse l'article L215-3 du Code de la consommation, dispose que ces règles sont applicables aux contrats conclus entre des professionnels et des non-professionnels.
            </p>
            <p className="mt-4">
              L'article L241-3 sanctionne le professionnel qui n'aurait pas procédé aux remboursements dans les conditions prévues à l'article L 215-1 du Code de la consommation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              ARTICLE 4 - Conditions de paiement
            </h2>
            <p>
              Le prix est payé par voie de paiement sécurisé, selon les modalités suivantes :
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>paiement par carte bancaire</li>
            </ul>
            <p className="mt-4">
              Le prix est payable comptant par le Client, en totalité au jour de la passation de la commande.
            </p>
            <p className="mt-4">
              Les données de paiement sont échangées en mode crypté grâce au protocole défini par le prestataire de paiement agréé intervenant pour les transactions bancaires réalisées sur le site bilibou.com.
            </p>
            <p className="mt-4">
              Les paiements effectués par le Client ne seront considérés comme définitifs qu'après encaissement effectif des sommes dues, par le Prestataire.
            </p>
            <p className="mt-4">
              Le Prestataire ne sera pas tenu de procéder à la fourniture des Services commandés par le Client si celui-ci ne lui en paye pas le prix en totalité dans les conditions ci-dessus indiquées.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              ARTICLE 5 - Fourniture des Prestations
            </h2>
            <p>
              Les Services commandés par le Client seront fournis selon les modalités suivantes :
            </p>
            <p className="mt-4">
              Les prestations sont fournies sous la forme d'un accès en ligne au logiciel bilibou.com, immédiatement après confirmation du paiement. Le service est accessible 24h/24 et 7j/7, sous réserve des éventuelles opérations de maintenance ou de mises à jour techniques. Le Client accède à son espace personnel via une connexion sécurisée lui permettant d'utiliser les fonctionnalités incluses dans l'abonnement souscrit.
            </p>
            <p className="mt-4">
              Lesdits Services seront fournis dans un délai maximum. La fourniture des prestations est immédiate dès la validation du paiement. L'accès au service est accordé en quelques minutes, sans délai d'attente, à compter de la validation définitive de la commande du Client, dans les conditions prévues aux présentes CGV à l'adresse indiquée par le Client lors de sa commande sur le site bilibou.com.
            </p>
            <p className="mt-4">
              Le Prestataire s'engage à faire ses meilleurs efforts pour fournir les Services commandés par le Client, dans le cadre d'une obligation de moyen et dans les délais ci-dessus précisés.
            </p>
            <p className="mt-4">
              Si les Services commandés n'ont pas été fournis dans un délai de. En cas de non-fourniture du service dans un délai de 7 jours après la validation du paiement, le Client pourra annuler sa commande par écrit et obtenir le remboursement intégral des sommes versées, après la date indicative de fourniture, pour toute autre cause que la force majeure ou le fait du Client, la vente des Services pourra être résolue à la demande écrite du Client dans les conditions prévues aux articles L 216-2, L 216-3 et L241-4 du Code de la consommation. Les sommes versées par le Client lui seront alors restituées au plus tard dans les quatorze jours qui suivent la date de dénonciation du contrat, à l'exclusion de toute indemnisation ou retenue.
            </p>
            <p className="mt-4">
              En cas de demande particulière du Client concernant les conditions de fourniture des Services, dûment acceptées par écrit par le Prestataire, les coûts y étant liés feront l'objet d'une facturation spécifique complémentaire ultérieure.
            </p>
            <p className="mt-4">
              A défaut de réserves ou réclamations expressément émises par le Client lors de la réception des Services, ceux-ci seront réputés conformes à la commande, en quantité et qualité.
            </p>
            <p className="mt-4">
              Le Client disposera d'un délai. Le Client dispose d'un délai de 30 jours à compter de la fourniture du service pour formuler toute réclamation. à compter de la fourniture des Services pour émettre des réclamations. Les réclamations doivent être adressées par email à l'adresse suivante : contact@bilibou.com, en précisant l'objet de la demande et les informations permettant l'identification du compte concerné, avec tous les justificatifs y afférents, auprès du Prestataire.
            </p>
            <p className="mt-4">
              Aucune réclamation ne pourra être valablement acceptée en cas de non respect de ces formalités et délais par le Client.
            </p>
            <p className="mt-4">
              Le Prestataire remboursera ou rectifiera dans les plus brefs délais et à ses frais les Services dont le défaut de conformité aura été dûment prouvé par le Client.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              ARTICLE 6 - Droit de rétractation
            </h2>
            <p>
              Compte tenu de la nature des Services fournis, les commandes passées par le Client ne bénéficient pas du droit de rétractation.
            </p>
            <p className="mt-4">
              Le contrat est donc conclu de façon définitive dès la passation de la commande par le Client selon les modalités précisées aux présentes CGV.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              ARTICLE 7 - Responsabilité du Prestataire - Garanties
            </h2>
            <p>
              Le Prestataire garantit, conformément aux dispositions légales et sans paiement complémentaire, le Client, contre tout défaut de conformité ou vice caché, provenant d'un défaut de conception ou de réalisation des Services commandés dans les conditions et selon les modalités suivantes :
            </p>
            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
              Dispositions relatives aux garanties légales
            </h3>
            <p className="font-semibold mt-4">Article L217-4 du Code de la consommation</p>
            <blockquote className="border-l-4 border-primary pl-4 my-4 italic">
              « Le vendeur est tenu de livrer un bien conforme au contrat et répond des défauts de conformité existant lors de la délivrance. Il répond également des défauts de conformité résultant de l'emballage, des instructions de montage ou de l'installation lorsque celle-ci a été mise à sa charge par le contrat ou a été réalisée sous sa responsabilité. »
            </blockquote>
            <p className="font-semibold mt-4">Article L217-5 du Code de la consommation</p>
            <blockquote className="border-l-4 border-primary pl-4 my-4 italic">
              « Le bien est conforme au contrat :
              <br/>
              1° S'il est propre à l'usage habituellement attendu d'un bien semblable et, le cas échéant :
              <br/>
              - s'il correspond à la description donnée par le vendeur et possède les qualités que celui-ci a présentées à l'acheteur sous forme d'échantillon ou de modèle ;
              <br/>
              - s'il présente les qualités qu'un acheteur peut légitimement attendre eu égard aux déclarations publiques faites par le vendeur, par le producteur ou par son représentant, notamment dans la publicité ou l'étiquetage ;
              <br/>
              2° Ou s'il présente les caractéristiques définies d'un commun accord par les parties ou est propre à tout usage spécial recherché par l'acheteur, porté à la connaissance du vendeur et que ce dernier a accepté. »
            </blockquote>
            <p className="font-semibold mt-4">Article L217-12 du Code de la consommation</p>
            <blockquote className="border-l-4 border-primary pl-4 my-4 italic">
              « L'action résultant du défaut de conformité se prescrit par deux ans à compter de la délivrance du bien. »
            </blockquote>
            <p className="font-semibold mt-4">Article L217-16 du Code de la consommation</p>
            <blockquote className="border-l-4 border-primary pl-4 my-4 italic">
              « Lorsque l'acheteur demande au vendeur, pendant le cours de la garantie commerciale qui lui a été consentie lors de l'acquisition ou de la réparation d'un bien meuble, une remise en état couverte par la garantie, toute période d'immobilisation d'au moins sept jours vient s'ajouter à la durée de la garantie qui restait à courir. Cette période court à compter de la demande d'intervention de l'acheteur ou de la mise à disposition pour réparation du bien en cause, si cette mise à disposition est postérieure à la demande d'intervention. »
            </blockquote>
            <p className="mt-4">
              Afin de faire valoir ses droits, le Client devra informer le Prestataire, par écrit (mail ou courrier), de l'existence des vices ou défauts de conformité.
            </p>
            <p className="mt-4">
              Le Prestataire remboursera ou rectifiera ou fera rectifier (dans la mesure du possible) les services jugés défectueux dans les meilleurs délais et au plus tard dans les. Délai maximal : 30 jours suivant la constatation du défaut ou du dysfonctionnement par le Prestataire, jours suivant la constatation par le Prestataire du défaut ou du vice. Ce remboursement pourra être fait par virement ou chèque bancaire.
            </p>
            <p className="mt-4">
              La garantie du Prestataire est limitée au remboursement des Services effectivement payés par le Client.
            </p>
            <p className="mt-4">
              Le Prestataire ne pourra être considéré comme responsable ni défaillant pour tout retard ou inexécution consécutif à la survenance d'un cas de force majeure habituellement reconnu par la jurisprudence française.
            </p>
            <p className="mt-4">
              Les Services fournis par l'intermédiaire du site du Prestataire sont conformes à la réglementation en vigueur en France. La responsabilité du Prestataire ne saurait être engagée en cas de non respect de la législation du pays dans lequel les Services sont fournis, qu'il appartient au Client, qui est seul responsable du choix des Services demandés, de vérifier.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              ARTICLE 8 - Données personnelles
            </h2>
            <p>
              Le Client est informé que la collecte de ses données à caractère personnel est nécessaire à la vente des Services et leur réalisation et délivrance, confiées au Prestataire. Ces données à caractère personnel sont récoltées uniquement pour l'exécution du contrat de prestations de services.
            </p>
            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
              8.1 Collecte des données à caractère personnel
            </h3>
            <p>
              Les données à caractère personnel qui sont collectées sur le site bilibou.com sont les suivantes :
            </p>
            <p className="font-semibold mt-4">Ouverture de compte</p>
            <p className="mt-2">
              Lors de la création du compte Client / utilisateur : Noms, prénoms, adresse postale, numéro de téléphone et adresse e-mail.
            </p>
            <p className="font-semibold mt-4">Paiement</p>
            <p className="mt-2">
              Dans le cadre du paiement des Prestations proposés sur le site bilibou.com, celui-ci enregistre des données financières relatives au compte bancaire ou à la carte de crédit du Client / utilisateur.
            </p>
            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
              8.2 Destinataires des données à caractère personnel
            </h3>
            <p>
              Les données à caractère personnel sont utilisées par le Prestataire et ses co-contractants pour l'exécution du contrat et pour assurer l'efficacité de la prestation de services, sa réalisation et sa délivrance.
            </p>
            <p className="mt-4">
              La ou les catégorie(s) de co-contractant(s) est (sont) :
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>Les prestataires établissements de paiement</li>
              <li>Vercel → Prestataire d'hébergement et de diffusion du site web (hébergeur cloud).</li>
              <li>Supabase → Prestataire de stockage et de gestion des données (base de données sécurisée et authentification utilisateurs).</li>
            </ul>
            <p className="mt-4">
              Le responsable de traitement des données est le Prestataire, au sens de la loi Informatique et libertés et à compter du 25 mai 2018 du Règlement 2016/679 sur la protection des données à caractère personnel.
            </p>
            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
              8.4 Limitation du traitement
            </h3>
            <p>
              Sauf si le Client exprime son accord exprès, ses données à caractère personnelles ne sont pas utilisées à des fins publicitaires ou marketing.
            </p>
            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
              8.5 Durée de conservation des données
            </h3>
            <p>
              Le Prestataire conservera les données ainsi recueillies pendant un délai de 5 ans, couvrant le temps de la prescription de la responsabilité civile contractuelle applicable.
            </p>
            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
              8.6 Sécurité et confidentialité
            </h3>
            <p>
              Le Prestataire met en oeuvre des mesures organisationnelles, techniques, logicielles et physiques en matière de sécurité du numérique pour protéger les données personnelles contre les altérations, destructions et accès non autorisés. Toutefois il est à signaler qu'Internet n'est pas un environnement complètement sécurisé et le Prestataire ne peut garantir la sécurité de la transmission ou du stockage des informations sur Internet.
            </p>
            <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
              8.7 Mise en oeuvre des droits des Clients et utilisateurs
            </h3>
            <p>
              En application de la règlementation applicable aux données à caractère personnel, les Clients et utilisateurs du site bilibou.com disposent des droits suivants :
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 mt-4">
              <li>Ils peuvent mettre à jour ou supprimer les données qui les concernent. Le Client peut à tout moment demander la suppression de ses données personnelles en adressant une demande par email à contact@bilibou.com. La suppression complète du compte et des données associées est effectuée dans un délai maximal de 30 jours à compter de la réception de la demande, sauf obligations légales de conservation (facturation, comptabilité, etc.).</li>
              <li>Ils peuvent supprimer leur compte en écrivant à l'adresse électronique indiqué à l'article 9.3 « Responsable de traitement »</li>
              <li>Ils peuvent exercer leur droit d'accès pour connaître les données personnelles les concernant en écrivant à l'adresse indiqué à l'article 9.3 « Responsable de traitement »</li>
              <li>Si les données à caractère personnel détenues par le Prestataire sont inexactes, ils peuvent demander la mise à jour des informations en écrivant à l'adresse indiqué à l'article 9.3 « Responsable de traitement »</li>
              <li>Ils peuvent demander la suppression de leurs données à caractère personnel, conformément aux lois applicables en matière de protection des données en écrivant à l'adresse indiqué à l'article 9.3 « Responsable de traitement »</li>
              <li>Ils peuvent également solliciter la portabilité des données détenues par le Prestataire vers un autre prestataire</li>
              <li>Enfin, ils peuvent s'opposer au traitement de leurs données par le Prestataire</li>
            </ul>
            <p className="mt-4">
              Ces droits, dès lors qu'ils ne s'opposent pas à la finalité du traitement, peuvent être exercé en adressant une demande par courrier ou par E-mail au Responsable de traitement dont les coordonnées sont indiquées ci-dessus.
            </p>
            <p className="mt-4">
              Le responsable de traitement doit apporter une réponse dans un délai maximum d'un mois. En cas de refus de faire droit à la demande du Client, celui-ci doit être motivé.
            </p>
            <p className="mt-4">
              Le Client est informé qu'en cas de refus, il peut introduire une réclamation auprès de la CNIL (3 place de Fontenoy, 75007 PARIS) ou saisir une autorité judiciaire.
            </p>
            <p className="mt-4">
              Le Client peut être invité à cocher une case au titre de laquelle il accepte de recevoir des mails à caractère informatifs et publicitaires de la part du Prestataire. Il aura toujours la possibilité de retirer son accord à tout moment en contactant le Prestataire (coordonnées ci-dessus) ou en suivant le lien de désabonnement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              ARTICLE 9 - Propriété intellectuelle
            </h2>
            <p>
              Le contenu du site bilibou.com est la propriété du Vendeur et de ses partenaires et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.
            </p>
            <p className="mt-4">
              Toute reproduction totale ou partielle de ce contenu est strictement interdite et est susceptible de constituer un délit de contrefaçon.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              ARTICLE 10 - Droit applicable - Langue
            </h2>
            <p>
              Les présentes CGV et les opérations qui en découlent sont régies et soumises au droit français.
            </p>
            <p className="mt-4">
              Les présentes CGV sont rédigées en langue française. Dans le cas où elles seraient traduites en une ou plusieurs langues étrangères, seul le texte français ferait foi en cas de litige.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              ARTICLE 11 - Litiges
            </h2>
            <p>
              Pour toute réclamation merci de contacter le service clientèle à l'adresse postale ou mail du Prestataire indiquée à l'ARTICLE 1 des présentes CGV.
            </p>
            <p className="mt-4">
              Le Client est informé qu'il peut en tout état de cause recourir à une médiation conventionnelle, auprès des instances de médiation sectorielles existantes ou à tout mode alternatif de règlement des différends (conciliation, par exemple) en cas de contestation.
            </p>
            <p className="mt-4">
              En l'espèce, le médiateur désigné est : _______________ E-mail : _______________.
            </p>
            <p className="mt-4">
              Le Client est également informé qu'il peut, également recourir à la plateforme de Règlement en Ligne des Litige (RLL) : https://webgate.ec.europa.eu/odr/main/index.cfm?event=main.home.show
            </p>
            <p className="mt-4">
              Tous les litiges auxquels les opérations d'achat et de vente conclues en application des présentes CGV et qui n'auraient pas fait l'objet d'un règlement amiable entre le vendeur ou par médiation, seront soumis aux tribunaux compétents dans les conditions de droit commun.
            </p>
          </section>

          <p className="text-sm text-muted-foreground mt-8">
            Réalisé sur https://www.legalplace.fr
          </p>
        </div>
      </div>
      <FooterSection />
    </div>
  )
}

