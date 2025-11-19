'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Mail, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState<string>('')
  const [isVerified, setIsVerified] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    // Récupérer l'email depuis localStorage
    const pendingEmail = localStorage.getItem('pending_verification_email')
    if (pendingEmail) {
      setEmail(pendingEmail)
    }

    // Vérifier si l'email est déjà confirmé
    const checkVerification = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user?.email_confirmed_at) {
          setIsVerified(true)
          setIsChecking(false)
          
          // Nettoyer le localStorage
          localStorage.removeItem('pending_verification_email')
          
          // Rediriger vers onboarding après 2 secondes
          setTimeout(() => {
            const onboardingCompleted = session.user.user_metadata?.onboarding_completed || false
            router.push(onboardingCompleted ? '/dashboard' : '/onboarding')
          }, 2000)
        } else {
          setIsChecking(false)
        }
      } catch (err) {
        console.error('Erreur lors de la vérification:', err)
        setIsChecking(false)
      }
    }

    checkVerification()

    // Vérifier périodiquement si l'email est confirmé
    const interval = setInterval(checkVerification, 2000)
    return () => clearInterval(interval)
  }, [router])

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return

    setIsResending(true)
    setError('')

    try {
      const supabase = createClient()
      const emailToResend = email || localStorage.getItem('pending_verification_email') || ''
      
      if (!emailToResend) {
        setError('Aucun email trouvé. Veuillez vous reconnecter.')
        setIsResending(false)
        return
      }

      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: emailToResend,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (resendError) {
        setError(resendError.message || 'Erreur lors de l\'envoi de l\'email')
        setIsResending(false)
        return
      }

      // Définir le cooldown de 60 secondes
      setResendCooldown(60)
      setIsResending(false)

      // Décrémenter le cooldown chaque seconde
      const cooldownInterval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownInterval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi de l\'email')
      setIsResending(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white">
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
                Redirection en cours...
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
  )
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
  )
}
