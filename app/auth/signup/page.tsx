'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Vérifier si un plan a été sélectionné avant l'inscription
  useEffect(() => {
    const plan = localStorage.getItem('selected_plan');
    const shouldRedirect = localStorage.getItem('plan_redirect');
    if (plan && shouldRedirect === 'true') {
      setSelectedPlan(plan);
    }
    
    // Vérifier s'il y a une erreur "no_email" dans l'URL
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('error') === 'no_email') {
      setError('Votre compte OAuth n\'a pas d\'email associé. Veuillez créer un compte avec email et mot de passe.');
    }
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Vérifier que les mots de passe correspondent
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    // Vérifier la longueur du mot de passe
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
      
      // Vérifier si un plan a été sélectionné
      const selectedPlan = localStorage.getItem('selected_plan');
      const shouldRedirect = localStorage.getItem('plan_redirect');
      
      if (selectedPlan && shouldRedirect === 'true') {
        // Nettoyer le localStorage
        localStorage.removeItem('selected_plan');
        localStorage.removeItem('plan_redirect');
        
        // Rediriger vers le paiement du plan choisi après 2 secondes
        setTimeout(async () => {
          try {
            const response = await fetch('/api/billing/checkout', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                planId: selectedPlan,
                isAnnual: false,
                source: 'signup'
              }),
            });

            if (response.ok) {
              const { url } = await response.json();
              window.location.href = url;
            } else {
              // En cas d'erreur, rediriger vers le dashboard
              router.push('/dashboard');
              router.refresh();
            }
          } catch (error) {
            console.error('Erreur lors de la redirection vers le paiement:', error);
            router.push('/dashboard');
            router.refresh();
          }
        }, 2000);
      } else {
        // Pas de plan sélectionné, rediriger vers le dashboard normalement
        setTimeout(() => {
          // Utiliser window.location.href pour forcer une navigation complète
          window.location.href = '/dashboard';
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignup = async (provider: 'google' | 'azure') => {
    try {
      // Sauvegarder le plan dans localStorage avant la redirection OAuth
      const plan = localStorage.getItem('selected_plan');
      const shouldRedirect = localStorage.getItem('plan_redirect');
      
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback${plan && shouldRedirect === 'true' ? `?plan=${plan}` : ''}`,
          // Forcer la demande de consentement pour récupérer les nouvelles permissions
          queryParams: provider === 'azure' ? {
            prompt: 'consent'
          } : undefined,
        },
      });

      if (error) {
        setError(error.message);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion OAuth');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Inscription</CardTitle>
          <CardDescription className="text-center">
            Créez votre compte Bilibou
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-center">
              ✅ Compte créé avec succès ! Redirection...
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              {/* Boutons OAuth */}
              <div className="space-y-3 mb-6">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={() => handleOAuthSignup('google')}
                  disabled={loading}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continuer avec Google
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={() => handleOAuthSignup('azure')}
                  disabled={loading}
                >
                  <svg className="w-5 h-5" viewBox="0 0 23 23">
                    <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                  </svg>
                  Continuer avec Microsoft
                </Button>
              </div>

              {/* Séparateur */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Ou avec email</span>
                </div>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    Mot de passe
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirmer le mot de passe
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Inscription...' : 'S\'inscrire'}
                </Button>
              </form>

              <div className="text-center text-sm text-gray-600 mt-6">
                Déjà un compte ?{' '}
                <a href="/auth/login" className="text-blue-600 hover:underline">
                  Se connecter
                </a>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



