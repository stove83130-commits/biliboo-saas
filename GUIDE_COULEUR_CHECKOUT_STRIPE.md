# Guide : Personnaliser la Couleur du Checkout Stripe

## ⚠️ Important

Le paramètre `brand_color` n'existe **PAS** dans l'API Stripe Checkout Sessions. Vous ne pouvez pas personnaliser la couleur directement via l'API.

## ✅ Solution : Via Stripe Dashboard

La personnalisation des couleurs du checkout Stripe se fait uniquement via le **Stripe Dashboard**, pas via l'API.

### Étapes :

1. **Allez sur [Stripe Dashboard](https://dashboard.stripe.com)**
2. **Basculez en mode PRODUCTION** (en haut à droite)
3. Allez dans **Settings** → **Branding**
4. Dans la section **"Checkout"** :
   - **Brand color** : Entrez `#10b981` (votre couleur émeraude)
   - Vous pouvez aussi personnaliser :
     - Logo
     - Favicon
     - Couleur du texte
5. **Sauvegardez**

### Autres Options de Personnalisation

Dans Stripe Dashboard → Settings → Branding → Checkout :

- **Brand color** : `#10b981` (couleur émeraude principale)
- **Background color** : Couleur de fond
- **Accent color** : Couleur d'accentuation
- **Logo** : Upload votre logo
- **Favicon** : Upload votre favicon

## 🎨 Couleurs Émeraude de Votre SaaS

Pour référence, voici les couleurs de votre dégradé émeraude :

```
#10b981 - emerald-500 (couleur principale)
#059669 - emerald-600 (couleur moyenne)
#047857 - emerald-700 (couleur foncée)
```

**Recommandation pour Stripe :** Utilisez `#10b981` (emerald-500) pour la couleur principale.

## ⚠️ Note

Les changements dans Stripe Dashboard sont **immédiats** et s'appliquent à toutes les nouvelles sessions de checkout. Vous n'avez **PAS besoin de redéployer** votre application.

