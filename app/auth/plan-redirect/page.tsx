'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function PlanRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const redirectToPlan = async () => {
      const plan = searchParams.get('plan');

      if (!plan) {
        // Pas de plan, rediriger vers le dashboard
        router.push('/dashboard');
        return;
      }

      try {
        // Créer une session de paiement Stripe
        const response = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planId: plan,
            isAnnual: false,
            source: 'oauth'
          }),
        });

        if (response.ok) {
          const { url } = await response.json();
          // Rediriger vers Stripe
          window.location.href = url;
        } else {
          setError('Erreur lors de la création de la session de paiement');
          setTimeout(() => {
            router.push('/dashboard');
          }, 3000);
        }
      } catch (error) {
        console.error('Erreur:', error);
        setError('Erreur lors de la redirection vers le paiement');
        setTimeout(() => {
          router.push('/dashboard');
        }, 3000);
      }
    };

    redirectToPlan();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Redirection vers le paiement</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-center w-full">
              {error}
              <p className="text-sm mt-2">Redirection vers le dashboard...</p>
            </div>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-center text-muted-foreground">
                Préparation de votre paiement...
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

