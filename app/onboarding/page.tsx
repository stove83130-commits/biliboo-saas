'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';

const ONBOARDING_STEPS = [
  {
    id: 'profile',
    question: 'Quel est votre profil ?',
    subtitle: 'Choisissez celui qui vous correspond le mieux',
    options: [
      { value: 'auto-entrepreneur', label: 'Auto-entrepreneur' },
      { value: 'ceo', label: 'CEO / Directeur général' },
      { value: 'daf', label: 'Directeur administratif et financier' },
      { value: 'comptable', label: 'Comptable / Expert-comptable' },
      { value: 'assistant', label: 'Assistant(e) administratif(ve)' },
      { value: 'achats', label: 'Responsable des achats' },
      { value: 'autre', label: 'Autre' },
    ],
  },
  {
    id: 'volume',
    question: 'Combien de factures recevez-vous par mois environ ?',
    subtitle: 'Cela nous aide à personnaliser votre expérience',
    options: [
      { value: 'moins-100', label: 'Moins de 100 factures' },
      { value: '100-300', label: '100 à 300 factures' },
      { value: '300-1200', label: '300 à 1 200 factures' },
      { value: 'plus-1200', label: 'Plus de 1 200 factures' },
      { value: 'je-ne-sais-pas', label: 'Je ne sais pas encore' },
    ],
  },
  {
    id: 'situation',
    question: 'Comment gérez-vous vos factures aujourd\'hui ?',
    subtitle: 'Sélectionnez toutes les options qui s\'appliquent',
    options: [
      { value: 'manuellement', label: 'Manuellement (emails, papier...)' },
      { value: 'logiciel-comptable', label: 'Avec un logiciel comptable' },
      { value: 'excel', label: 'Avec Excel/Google Sheets' },
      { value: 'comptable', label: 'Mon comptable s\'en occupe' },
      { value: 'mix', label: 'Un mix de tout ça' },
    ],
    multiple: true,
  },
  {
    id: 'acquisition',
    question: 'Comment avez-vous découvert Bilibou ?',
    subtitle: 'Cela nous aide à améliorer nos canaux',
    options: [
      { value: 'google', label: 'Recherche Google' },
      { value: 'recommandation', label: 'Recommandation d\'un ami/collègue' },
      { value: 'reseaux-sociaux', label: 'Réseaux sociaux' },
      { value: 'presse', label: 'Article de blog / Presse' },
      { value: 'publicite', label: 'Publicité en ligne' },
      { value: 'comptable-reco', label: 'Mon comptable m\'a recommandé' },
      { value: 'autre', label: 'Autre' },
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length;
  const isConsentStep = currentStep === ONBOARDING_STEPS.length;

  const handleOptionClick = (value: string) => {
    if (step.multiple) {
      // Multiples sélections
      setSelectedValues((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    } else {
      // Sélection unique
      setSelectedValues([value]);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      // Revenir à l'étape précédente
      setCurrentStep(currentStep - 1);
      // Restaurer les sélections de l'étape précédente
      const previousStepId = ONBOARDING_STEPS[currentStep - 1]?.id;
      setSelectedValues(answers[previousStepId] || []);
    }
  };

  const handleNext = async () => {
    if (currentStep < ONBOARDING_STEPS.length) {
      // Sauvegarder les réponses de l'étape actuelle
      if (selectedValues.length > 0) {
        setAnswers((prev) => ({
          ...prev,
          [step.id]: selectedValues,
        }));
      }

      // Si ce n'est pas la dernière étape, passer à la suivante
      if (currentStep < ONBOARDING_STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
        setSelectedValues(answers[ONBOARDING_STEPS[currentStep + 1].id] || []); // Restaurer les réponses existantes
      } else {
        // Passer à l'étape de consentement
        setCurrentStep(currentStep + 1);
      }
    } else if (isConsentStep && consent) {
      // Soumettre le formulaire
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!consent) {
      console.error('Consentement non donné');
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      let { data: { user }, error: userError } = await supabase.auth.getUser();

      if (!user || userError) {
        console.error('❌ Utilisateur non authentifié:', userError);
        // Attendre 1 seconde et réessayer
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { data: { user: retryUser }, error: retryError } = await supabase.auth.getUser();
        
        if (!retryUser || retryError) {
          console.error('❌ Retry échoué:', retryError);
          window.location.href = '/auth/login';
          return;
        }
        
        // Utiliser l'utilisateur du retry
        user = retryUser;
      }

      console.log('✅ Utilisateur authentifié:', user.email);

      // Mettre à jour les métadonnées avec les réponses
      const { error } = await supabase.auth.updateUser({
        data: {
          onboarding_completed: true,
          onboarding_responses: answers,
          profile: answers['profile']?.[0],
          volume: answers['volume']?.[0],
          situation: answers['situation'],
          acquisition: answers['acquisition']?.[0],
        },
      });

      if (error) {
        console.error('❌ Erreur lors de la sauvegarde:', error);
        alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
        return;
      }

      console.log('✅ Onboarding complété, redirection vers dashboard');
      
      // Vérifier que l'utilisateur est toujours connecté avant de rediriger
      const { data: { user: finalUser }, error: finalError } = await supabase.auth.getUser();
      
      if (finalError || !finalUser) {
        console.error('❌ Utilisateur non authentifié après onboarding:', finalError);
        // Si l'utilisateur n'est plus connecté, rediriger vers la connexion
        window.location.href = '/auth/login?error=session_expired';
        return;
      }
      
      // Vérifier que onboarding_completed est bien à true
      if (!finalUser.user_metadata?.onboarding_completed) {
        console.warn('⚠️ onboarding_completed pas à true, réessayant...');
        // Réessayer une fois
        await supabase.auth.updateUser({
          data: {
            ...finalUser.user_metadata,
            onboarding_completed: true,
          },
        });
      }
      
      // Rediriger vers le dashboard avec un petit délai pour s'assurer que les métadonnées sont sauvegardées
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
    } catch (error) {
      console.error('❌ Erreur:', error);
      alert('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = 
    (!isConsentStep && selectedValues.length > 0) || 
    (isConsentStep && consent);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header avec logo */}
      <div className="border-b border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Image 
            src="/logos/logo%20off.png" 
            alt="Bilibou Logo" 
            width={40} 
            height={40}
            className="h-10 w-auto"
          />
          <span className="text-lg font-semibold text-foreground">Bilibou</span>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          {/* Progress bar minimal */}
          <div className="mb-8">
            <div className="h-0.5 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${((currentStep + 1) / (ONBOARDING_STEPS.length + 1)) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Étape {currentStep + 1} sur {ONBOARDING_STEPS.length + 1}
            </p>
          </div>

        {/* Contenu */}
        <div className="min-h-[400px]">
          {!isConsentStep ? (
            <>
              <div className="mb-8">
                <h2 className="text-lg font-medium text-foreground mb-1">{step.question}</h2>
                <p className="text-sm text-muted-foreground">{step.subtitle}</p>
              </div>

              <div className="space-y-2">
                {step.options.map((option) => {
                  const isSelected = selectedValues.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleOptionClick(option.value)}
                      className={`w-full p-3 rounded-lg border transition-all text-left flex items-center ${
                        isSelected
                          ? 'border-primary bg-accent'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <span className="flex-1 text-sm text-foreground">{option.label}</span>
                      {isSelected && (
                        <span className="text-primary ml-2">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-foreground mb-1">Consentement et confidentialité</h2>
                <p className="text-sm text-muted-foreground">
                  Pour fonctionner, Bilibou a besoin d'accéder à vos emails de manière sécurisée pour extraire automatiquement vos factures.
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 bg-accent rounded-lg border border-border">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(checked) => setConsent(checked === true)}
                  className="mt-0.5"
                />
                <label htmlFor="consent" className="flex-1 text-sm text-muted-foreground leading-relaxed cursor-pointer">
                  J'autorise Bilibou à accéder à mes emails de manière sécurisée pour extraire automatiquement mes factures. Mes données ne sont jamais partagées avec des tiers et sont traitées conformément à notre{' '}
                  <a href="/politique-confidentialite" target="_blank" className="text-primary hover:underline">
                    Politique de confidentialité
                  </a>{' '}
                  et aux{' '}
                  <a href="/cgu" target="_blank" className="text-primary hover:underline">
                    Conditions d'utilisation
                  </a>.
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Boutons navigation */}
        <div className="mt-8 flex justify-between items-center">
          <Button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            variant="ghost"
            className="px-4"
          >
            ← Précédent
          </Button>
          
          <Button
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            className="px-6"
          >
            {isSubmitting ? 'Chargement...' : isConsentStep ? 'Terminer' : 'Continuer'}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
}
