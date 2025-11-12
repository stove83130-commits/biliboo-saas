"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CreditCard, Loader2 } from "lucide-react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js"

// Initialiser Stripe avec la clé publique
// La clé publique commence par pk_test_ ou pk_live_
const getStripePublishableKey = () => {
  // Essayer plusieurs noms de variables d'environnement possibles
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 
         process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY ||
         ''
}

const stripePublishableKey = getStripePublishableKey()
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

interface AddPaymentMethodDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function PaymentForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!stripe || !elements) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Créer un setup intent
      const response = await fetch('/api/billing/payment-methods', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la création du setup intent')
      }

      const { clientSecret } = await response.json()

      // Confirmer le setup intent avec la carte
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        throw new Error('Élément de carte non trouvé')
      }

      const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      })

      if (confirmError) {
        setError(confirmError.message || 'Erreur lors de l\'ajout de la carte')
        setLoading(false)
        return
      }

      if (setupIntent && setupIntent.status === 'succeeded') {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'ajout de la méthode de paiement')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Message informatif pour localhost */}
      {typeof window !== 'undefined' && window.location.protocol === 'http:' && (
        <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
          <p className="font-medium mb-1">⚠️ Connexion non sécurisée (localhost)</p>
          <p>En développement local, l'avertissement de sécurité est normal. Vous pouvez continuer à saisir votre carte manuellement.</p>
        </div>
      )}

      <div className="p-4 border border-border rounded-lg bg-white">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                fontFamily: 'system-ui, sans-serif',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
            hidePostalCode: false,
          }}
        />
      </div>
      
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Annuler
        </Button>
        <Button type="submit" disabled={loading || !stripe}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Ajout en cours...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Ajouter la carte
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AddPaymentMethodDialog({ open, onOpenChange, onSuccess }: AddPaymentMethodDialogProps) {
  // Vérifier si la clé publique est configurée
  const hasPublishableKey = typeof window !== 'undefined' && 
    (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY)

  if (!stripePromise || !hasPublishableKey) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ajouter une méthode de paiement</DialogTitle>
            <DialogDescription>
              <div className="space-y-2 mt-2">
                <p>La clé publique Stripe n'est pas configurée.</p>
                <p className="text-sm text-muted-foreground">
                  Pour ajouter cette fonctionnalité, configurez <code className="bg-muted px-1 rounded">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> dans vos variables d'environnement.
                </p>
                <p className="text-sm text-muted-foreground">
                  Vous pouvez trouver votre clé publique dans le Dashboard Stripe → Developers → API keys.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajouter une méthode de paiement</DialogTitle>
          <DialogDescription>
            Ajoutez une nouvelle carte pour faciliter vos futurs paiements
          </DialogDescription>
        </DialogHeader>
        <Elements stripe={stripePromise}>
          <PaymentForm 
            onSuccess={() => {
              onSuccess()
              onOpenChange(false)
            }}
            onCancel={() => onOpenChange(false)}
          />
        </Elements>
      </DialogContent>
    </Dialog>
  )
}

