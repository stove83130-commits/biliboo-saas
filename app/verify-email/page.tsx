'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Mail, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string>('');
  const [isVerified, setIsVerified] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Vérifier si on vient du callback avec confirmed=true
    const confirmed = searchParams.get('confirmed') === 'true';
    
    if (confirmed) {
      // Email confirmé ! Afficher le message de succès immédiatement
      setIsVerified(true);
      setIsChecking(false);
      
      // Nettoyer le localStorage
      localStorage.removeItem('pending_verification_email');
      
      // Nettoyer l'URL pour enlever le paramètre
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // Rediriger vers onboarding après 2 secondes pour laisser voir le message
      const redirectTimer = setTimeout(() => {
        router.push('/onboarding');
      }, 2000);
      
      return () => clearTimeout(redirectTimer);
    }

    // Si pas de confirmed=true, continuer avec le flow normal
    const checkEmailVerification = async () => {
      try {
        // Attendre un peu pour que le localStorage soit bien synchronisé
        await new Promise(resolve => setTimeout(resolve, 100));

        // PRIORITÉ 1: Récupérer l'email depuis localStorage (toujours vérifier en premier)
        const pendingEmail = localStorage.getItem('pending_verification_email');
        if (pendingEmail) {
          setEmail(pendingEmail);
          setIsChecking(false);
          // Ne pas retourner ici, continuer pour vérifier aussi la session
        }

        // PRIORITÉ 2: Vérifier si l'utilisateur a une session active
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        // Si l'utilisateur est authentifié (session active après confirmation)
        if (user && !userError) {
          // Utiliser l'email de la session si disponible
          if (user.email) {
            setEmail(user.email);
          }

          // Vérifier si l'email est déjà vérifié
          if (user.email_confirmed_at) {
            setIsVerified(true);
            setIsChecking(false);
            // Nettoyer le localStorage
            localStorage.removeItem('pending_verification_email');
            // Rediriger vers onboarding après 2 secondes pour laisser voir le message
            setTimeout(() => {
              router.push('/onboarding');
            }, 2000);
            return;
          }

          // Si session active mais email non confirmé, continuer à afficher la page
          setIsChecking(false);
          return;
        }

        // Si pas de session ET pas d'email en localStorage, afficher quand même la page
        // (peut-être que l'utilisateur a fermé l'onglet et revient)
        if (!pendingEmail) {
          // Ne PAS rediriger automatiquement, juste afficher un message
          setError('Veuillez vérifier votre email ou vous reconnecter.');
          setIsChecking(false);
        } else {
          setIsChecking(false);
        }
      } catch (err) {
        console.error('Erreur lors de la vérification:', err);
        setError('Erreur lors de la vérification de votre email');
        setIsChecking(false);
      }
    };

    checkEmailVerification();

    // Fonction pour vérifier la confirmation
    const checkConfirmation = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // Si l'utilisateur a maintenant une session et que l'email est confirmé
        if (user?.email_confirmed_at && !isVerified) {
          setIsVerified(true);
          // Nettoyer le localStorage
          localStorage.removeItem('pending_verification_email');
          
          // Rediriger vers onboarding après 2 secondes pour laisser voir le message de succès
          setTimeout(() => {
            router.push('/onboarding');
          }, 2000);
          return true; // Confirmation détectée
        }
        
        // Si l'utilisateur a maintenant une session mais pas encore d'email confirmé,
        // mettre à jour l'email affiché
        if (user?.email && user.email !== email) {
          setEmail(user.email);
        }
        return false;
      } catch (err) {
        console.error('Erreur lors de la vérification:', err);
        return false;
      }
    };

    // Polling toutes les 1.5 secondes pour vérifier si l'email est confirmé (plus rapide)
    const interval = setInterval(async () => {
      const confirmed = await checkConfirmation();
      if (confirmed) {
        clearInterval(interval);
      }
    }, 1500); // Polling plus rapide (1.5 secondes au lieu de 3)

    // Vérifier immédiatement quand la page devient visible (si l'utilisateur revient sur l'onglet)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !isVerified) {
        const confirmed = await checkConfirmation();
        if (confirmed) {
          clearInterval(interval);
        }
      }
    };

    // Vérifier quand la fenêtre reçoit le focus
    const handleFocus = async () => {
      if (!isVerified) {
        const confirmed = await checkConfirmation();
        if (confirmed) {
          clearInterval(interval);
        }
      }
    };

    // Ajouter les listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [router, isVerified, email]);

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;

    setIsResending(true);
    setError('');

    try {
      const supabase = createClient();
      
      // Utiliser l'email stocké ou celui de la session
      const emailToResend = email || localStorage.getItem('pending_verification_email') || '';
      
      if (!emailToResend) {
        setError('Aucun email trouvé. Veuillez vous reconnecter.');
        setIsResending(false);
        return;
      }

      // Déterminer l'URL de redirection pour la confirmation d'email
      const baseUrl = window.location.origin;
      const redirectUrl = `${baseUrl}/auth/callback`;
      
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: emailToResend,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (resendError) {
        setError(resendError.message || 'Erreur lors de l\'envoi de l\'email');
        setIsResending(false);
        return;
      }

      // Définir le cooldown de 60 secondes
      setResendCooldown(60);
      setIsResending(false);

      // Décrémenter le cooldown chaque seconde
      const cooldownInterval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi de l\'email');
      setIsResending(false);
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

      <div className="relative z-10 w-full max-w-md space-y-6 px-4">
        <div className="flex justify-center">
          <img 
            src="/logo_off__1_-removebg-preview.png" 
            alt="Bilibou Logo" 
            className="h-14 w-auto"
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-lg p-8 space-y-6">
          {isVerified ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="h-16 w-16 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Email confirmé !
              </h1>
              <p className="text-gray-600">
                Redirection vers l'onboarding...
              </p>
              <div className="flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            </div>
          ) : (
            <>
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <div className="rounded-full bg-emerald-100 p-4">
                    <Mail className="h-8 w-8 text-emerald-600" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Confirmez votre email
                </h1>
                <p className="text-gray-600 text-sm">
                  Nous avons envoyé un email de confirmation à
                </p>
                <p className="text-emerald-600 font-medium">
                  {email || 'votre adresse email'}
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-500 text-center">
                  Cliquez sur le lien dans l'email pour confirmer votre adresse et continuer.
                  Si vous ne voyez pas l'email, vérifiez votre dossier spam.
                </p>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleResendEmail}
                  disabled={isResending || resendCooldown > 0}
                  className="w-full h-10 bg-emerald-500 text-white hover:bg-emerald-600"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : resendCooldown > 0 ? (
                    `Renvoyer l'email (${resendCooldown}s)`
                  ) : (
                    "Renvoyer l'email"
                  )}
                </Button>

                <div className="text-center">
                  <Link
                    href="/auth/login"
                    className="text-sm text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Retour à la connexion
                  </Link>
                </div>
              </div>

              {isChecking && (
                <div className="text-center text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                  Vérification en cours...
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

