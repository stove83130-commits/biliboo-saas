# Guide : Vérifier les variables d'environnement Vercel

## Problème
L'authentification fonctionne en local mais pas en production. C'est généralement dû à des variables d'environnement manquantes ou incorrectes dans Vercel.

## Variables REQUISES pour Supabase

### 1. Allez sur votre dashboard Vercel
https://vercel.com/dashboard

### 2. Sélectionnez votre projet
Cliquez sur votre projet (biliboo-saas ou tradia)

### 3. Allez dans Settings > Environment Variables

### 4. Vérifiez que ces variables sont bien définies :

```
NEXT_PUBLIC_SUPABASE_URL=https://qkpfxpuhrjgctpadxslh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcGZ4cHVocmpnY3RwYWR4c2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NTYzMTgsImV4cCI6MjA3NDEzMjMxOH0.Blc5wlKE6g00AqYFdGmsRDeD3ZTKDQfOx4jVpmqA5n4
```

### 5. IMPORTANT : Vérifiez les environnements
Assurez-vous que ces variables sont définies pour :
- ✅ Production
- ✅ Preview
- ✅ Development

### 6. Après avoir ajouté/modifié les variables
1. Cliquez sur "Save"
2. **REDÉPLOYEZ** votre application (Settings > Deployments > Redeploy)

## Autres variables importantes (si utilisées)

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcGZ4cHVocmpnY3RwYWR4c2xoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODU1NjMxOCwiZXhwIjoyMDc0MTMyMzE4fQ.ml5wdjfgqmA1hGDvDX2Og7fx0iw_hf_AvF8lIwYvwLY
NEXT_PUBLIC_APP_URL=https://bilibou.com
```

## Vérification rapide

Si les variables ne sont pas définies, vous verrez des erreurs comme :
- "Cannot read properties of undefined"
- "Supabase URL is required"
- Erreurs d'authentification 401/403

## Solution rapide

1. Copiez les variables depuis votre `.env.local` local
2. Ajoutez-les dans Vercel (Settings > Environment Variables)
3. Redéployez l'application

