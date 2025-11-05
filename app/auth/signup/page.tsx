'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        options: {
          data: {
            onboarding_completed: false,
          },
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
      
      // Stocker l'email dans localStorage pour l'afficher sur la page de vérification
      // (car Supabase ne crée pas de session immédiatement après signUp)
      localStorage.setItem('pending_verification_email', email);
      
      // Rediriger IMMÉDIATEMENT vers la page de vérification d'email
      // L'utilisateur devra confirmer son email avant d'accéder à l'application
      // Utiliser window.location.href pour forcer une navigation complète
      window.location.href = '/verify-email';
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
          <h1 className="text-2xl font-bold text-foreground">Inscription</h1>
          <p className="text-xs text-muted-foreground">Rejoignez Bilibou</p>
        </div>

        {success ? (
          <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-center text-sm">
            ✅ Compte créé avec succès ! Redirection...
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}

            {/* OAuth Buttons */}
            <div className="space-y-2">
              {/* Google Sign In */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-9 border-border bg-background text-sm text-foreground hover:bg-secondary"
                onClick={() => handleOAuthSignup('google')}
                disabled={loading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </Button>

              {/* Microsoft Sign In */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-9 border-border bg-background text-sm text-foreground hover:bg-secondary"
                onClick={() => handleOAuthSignup('azure')}
                disabled={loading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 23 23">
                  <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                  <path fill="#f35325" d="M1 1h10v10H1z"/>
                  <path fill="#81bc06" d="M12 1h10v10H12z"/>
                  <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                  <path fill="#ffba08" d="M12 12h10v10H12z"/>
                </svg>
                Microsoft
              </Button>
            </div>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">Ou</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSignup} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-foreground">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                  required
                  disabled={loading}
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs text-foreground">
                  Mot de passe
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

              {/* Confirm Password Field */}
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
                {loading ? 'Inscription...' : 'S\'inscrire'}
              </Button>

              {/* Terms and Privacy */}
              <p className="text-center text-xs text-muted-foreground">
                En vous inscrivant, vous acceptez les{' '}
                <a href="/cgu" target="_blank" className="text-primary hover:underline transition-colors">
                  Conditions d'utilisation
                </a>{' '}
                et la{' '}
                <a href="/politique-confidentialite" target="_blank" className="text-primary hover:underline transition-colors">
                  Politique de confidentialité
                </a>.
              </p>

              {/* Login Link */}
              <p className="text-center text-xs text-muted-foreground">
                Déjà un compte ?{" "}
                <a href="/auth/login" className="text-primary hover:underline transition-colors">
                  Se connecter
                </a>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}



