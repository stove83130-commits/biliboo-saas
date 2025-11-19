# Configuration des Emails avec Resend

Ce document explique comment configurer différents types d'emails avec différents expéditeurs dans l'application.

## Variables d'environnement

**Configuration minimale** : Ajoutez simplement cette ligne dans votre `.env.local` :

```env
# Clé API Resend (obligatoire)
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

Le système utilisera automatiquement `no-reply@bilibou.com` pour les exports.

**Configuration complète** (optionnelle) : Si vous souhaitez personnaliser les emails :

```env
# Clé API Resend (obligatoire)
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Email no-reply pour les exports (optionnel - par défaut: no-reply@bilibou.com)
EXPORTS_NO_REPLY_EMAIL=no-reply@bilibou.com

# Nom de l'expéditeur pour les exports (optionnel - par défaut: Bilibou)
EXPORTS_FROM_NAME=Bilibou

# Email fallback pour les exports (optionnel)
EXPORTS_FROM_EMAIL=exports@bilibou.com

# Email pour les invitations workspace (optionnel - par défaut: noreply@bilibou.com)
INVITES_FROM_EMAIL=noreply@bilibou.com

# Nom de l'expéditeur pour les invitations (optionnel - par défaut: Bilibou)
INVITES_FROM_NAME=Bilibou

# Email pour les contacts (optionnel - par défaut: noreply@bilibou.com)
CONTACT_FROM_EMAIL=contact@bilibou.com

# Nom de l'expéditeur pour les contacts (optionnel - par défaut: Bilibou)
CONTACT_FROM_NAME=Bilibou
```

**Note importante** : 
- Par défaut, le système utilise `Bilibou <no-reply@bilibou.com>` pour les exports
- Vous n'avez **qu'à ajouter** `RESEND_API_KEY` dans votre `.env.local`
- Les autres variables sont optionnelles et utilisent `bilibou.com` par défaut
- Le nom de l'expéditeur peut être personnalisé avec `EXPORTS_FROM_NAME` (par défaut: "Bilibou")

## Types d'emails supportés

### 1. Exports (`emailType: 'exports'`)
- **Variable utilisée** : `EXPORTS_NO_REPLY_EMAIL` (priorité) ou `EXPORTS_FROM_EMAIL`
- **Usage** : Envoi d'exports ZIP, CSV, PDF
- **Recommandation** : Utiliser un email `no-reply@` car ces emails ne nécessitent généralement pas de réponse

### 2. Invitations (`emailType: 'invites'`)
- **Variable utilisée** : `INVITES_FROM_EMAIL` ou `EXPORTS_FROM_EMAIL` (fallback)
- **Usage** : Invitations à rejoindre un workspace
- **Recommandation** : Utiliser un email qui peut recevoir des réponses

### 3. Contacts (`emailType: 'contact'`)
- **Variable utilisée** : `CONTACT_FROM_EMAIL` ou `EXPORTS_FROM_EMAIL` (fallback)
- **Usage** : Emails de contact depuis le formulaire
- **Recommandation** : Utiliser un email qui peut recevoir des réponses

### 4. Par défaut
- **Variable utilisée** : `EXPORTS_FROM_EMAIL` ou `EXPORTS_NO_REPLY_EMAIL`
- **Usage** : Si aucun type n'est spécifié

## Utilisation dans le code

### Exemple 1 : Envoi d'export ZIP avec no-reply

```typescript
await fetch('/api/exports/email', {
  method: 'POST',
  body: JSON.stringify({
    to: 'user@example.com',
    emailType: 'exports', // Utilisera EXPORTS_NO_REPLY_EMAIL
    subject: 'Export ZIP - Factures',
    attachments: [...]
  })
})
```

### Exemple 2 : Spécifier un expéditeur personnalisé

```typescript
await fetch('/api/exports/email', {
  method: 'POST',
  body: JSON.stringify({
    to: 'user@example.com',
    fromEmail: 'custom@example.com', // Override le type
    subject: 'Email personnalisé',
    attachments: [...]
  })
})
```

## Configuration Resend

1. **Créer un compte Resend** : https://resend.com
2. **Ajouter votre domaine** : Dans le dashboard Resend, ajoutez et vérifiez votre domaine
3. **Créer des adresses email** : Créez les adresses email que vous souhaitez utiliser (ex: `no-reply@votredomaine.com`)
4. **Récupérer la clé API** : Dans les paramètres API, créez une clé et ajoutez-la à `RESEND_API_KEY`

## Vérification

Pour vérifier que la configuration fonctionne, consultez les logs du serveur. Vous devriez voir :

```
📧 [EMAIL] Envoi depuis: no-reply@votredomaine.com (type: exports)
```

## Notes importantes

- **Domaine vérifié** : Assurez-vous que tous les domaines utilisés sont vérifiés dans Resend
- **Limites** : Resend a des limites selon votre plan (gratuit : 100 emails/jour)
- **Spam** : Utilisez `no-reply@` pour les emails automatiques pour éviter les réponses non désirées
- **Fallback** : Si une variable n'est pas définie, le système utilisera les fallbacks dans l'ordre de priorité

