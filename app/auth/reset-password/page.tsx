'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Vérifier si on a les paramètres nécessaires
    const code = searchParams.get('code');
    if (!code) {
      setError('Lien de réinitialisation invalide ou expiré');
    }
  }, [searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);

    try {
      const code = searchParams.get('code');
      
      if (!code) {
        setError('Lien de réinitialisation invalide');
        return;
      }

      // Utiliser l'API route pour éviter les redirections automatiques
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Une erreur est survenue');
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/auth/login');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white">
      {/* Organic green shapes background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-emerald-100/40 blur-3xl"></div>
        <div className="absolute right-10 top-40 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl"></div>
        <div className="absolute bottom-20 left-1/3 h-72 w-72 rounded-full bg-teal-100/50 blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-5 px-4">
        <div className="flex justify-center">
          <img 
            src="/logo_off__1_-removebg-preview.png" 
            alt="Bilibou Logo" 
            className="h-14 w-auto"
          />
        </div>

        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-foreground">Nouveau mot de passe</h1>
          <p className="text-xs text-muted-foreground">Choisissez un nouveau mot de passe sécurisé</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        {success ? (
          <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm text-center">
            ✅ Mot de passe modifié avec succès ! Redirection...
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-foreground">
                Nouveau mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 border-border bg-background pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs text-foreground">
                Confirmer le mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-9 border-border bg-background pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={loading}
                >
                  {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-9 bg-emerald-500 text-sm text-white hover:bg-emerald-600 shadow-lg"
              disabled={loading}
            >
              {loading ? 'Modification...' : 'Modifier le mot de passe'}
            </Button>

            <p className="text-center text-xs">
              <a href="/auth/login" className="text-muted-foreground hover:text-primary transition-colors">
                Retour à la connexion
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white">
        <div className="relative z-10 w-full max-w-sm space-y-5 px-4">
          <div className="flex justify-center">
            <img 
              src="/logo_off__1_-removebg-preview.png" 
              alt="Bilibou Logo" 
              className="h-14 w-auto"
            />
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Chargement...</p>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

