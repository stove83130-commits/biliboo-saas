# Configuration des Variables d'Environnement pour les Emails

## Variables à configurer dans Vercel

### Pour Resend (Recommandé - en priorité)

1. **RESEND_API_KEY**
   - Valeur : Votre clé API Resend (commence par `re_...`)
   - Où la trouver : https://resend.com/api-keys
   - Exemple : `re_1234567890abcdef`

2. **EXPORTS_FROM_EMAIL** (optionnel mais recommandé)
   - Valeur : Un email vérifié dans Resend
   - Format : `noreply@votre-domaine.com` ou un domaine que vous avez vérifié sur Resend
   - Important : L'email doit être vérifié dans votre compte Resend

3. **INVITES_FROM_EMAIL** (optionnel)
   - Valeur : Email pour les invitations (utilise EXPORTS_FROM_EMAIL si non défini)
   - Format : `noreply@votre-domaine.com`

### Pour SMTP (Fallback si Resend n'est pas configuré)

1. **SMTP_HOST**
   - Valeur : `smtp.gmail.com` (pour Gmail)
   - Autres options :
     - Outlook : `smtp-mail.outlook.com`
     - Autre : Vérifier avec votre fournisseur email

2. **SMTP_PORT**
   - Valeur : `587` (TLS)
   - Alternative : `465` (SSL, nécessite SMTP_SECURE=true)

3. **SMTP_SECURE**
   - Valeur : `false` (pour port 587)
   - Valeur : `true` (pour port 465 avec SSL)

4. **SMTP_USER**
   - Valeur : Votre adresse email complète
   - Exemple : `votre-email@gmail.com`

5. **SMTP_PASS**
   - Valeur : **Mot de passe d'application Gmail** (PAS votre mot de passe normal)
   - Comment obtenir :
     1. Allez sur https://myaccount.google.com/security
     2. Activez la vérification en 2 étapes
     3. Créez un mot de passe d'application : Sécurité > Vérification en 2 étapes > Mots de passe des applications
     4. Sélectionnez "Autre" et donnez un nom (ex: "Bilibou SMTP")
     5. Copiez le mot de passe de 16 caractères

6. **SMTP_FROM**
   - Valeur : L'adresse email qui apparaîtra comme expéditeur
   - Exemple : `noreply@bilibou.com`
   - Peut être différent de SMTP_USER

## Ordre de priorité pour l'envoi d'emails

Le système essaie dans cet ordre :
1. **Resend** (si RESEND_API_KEY est configuré)
2. **SMTP** (si Resend n'est pas configuré ou échoue)

## Vérification

Pour vérifier que tout fonctionne :
1. Allez dans votre projet Vercel
2. Settings > Environment Variables
3. Vérifiez que toutes les variables sont bien configurées
4. Après déploiement, testez une invitation
5. Vérifiez les logs dans Vercel (Functions > Logs) pour voir si l'email est envoyé

## Troubleshooting

### L'email n'est pas envoyé

1. Vérifiez les logs Vercel pour voir les erreurs
2. Assurez-vous que :
   - `RESEND_API_KEY` contient votre vraie clé (commence par `re_`)
   - `EXPORTS_FROM_EMAIL` utilise un domaine vérifié dans Resend
   - Ou que SMTP est correctement configuré avec un mot de passe d'application (pas le mot de passe normal)

### Erreur "Invalid API key" (Resend)

- Vérifiez que votre clé API Resend est correcte
- Assurez-vous que vous copiez bien toute la clé (commence par `re_`)

### Erreur "Authentication failed" (SMTP)

- Utilisez un **mot de passe d'application**, pas votre mot de passe Gmail normal
- Vérifiez que la vérification en 2 étapes est activée
- Vérifiez que `SMTP_USER` contient votre email complet

