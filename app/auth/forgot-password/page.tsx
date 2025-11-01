'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      // Rediriger directement vers la page de reset password
      // Supabase ajoutera automatiquement le code et type=recovery dans l'URL
      const redirectUrl = `${window.location.origin}/auth/reset-password`;
      
      console.log('Sending password reset email to:', email);
      console.log('Redirect URL:', redirectUrl);
      
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      console.log('Reset password response:', { data, error });

      if (error) {
        console.error('Error sending reset email:', error);
        setError(error.message || 'Erreur lors de l\'envoi de l\'email');
      } else {
        console.log('✅ Email de réinitialisation envoyé avec succès');
        console.log('Redirect URL utilisé:', redirectUrl);
        console.log('Vérifiez votre boîte mail (et les spams)');
        setSuccess(true);
      }
    } catch (err: any) {
      console.error('Exception during password reset:', err);
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
          <h1 className="text-2xl font-bold text-foreground">Mot de passe oublié</h1>
          <p className="text-xs text-muted-foreground">Saisissez votre email pour recevoir un lien de réinitialisation</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm text-center">
              ✅ Un email de réinitialisation a été envoyé à {email}. Vérifiez votre boîte de réception.
            </div>
            <Button
              onClick={() => router.push('/auth/login')}
              className="w-full h-9 bg-emerald-500 text-sm text-white hover:bg-emerald-600 shadow-lg"
            >
              Retour à la connexion
            </Button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
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

            <Button 
              type="submit" 
              className="w-full h-9 bg-emerald-500 text-sm text-white hover:bg-emerald-600 shadow-lg"
              disabled={loading}
            >
              {loading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
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

