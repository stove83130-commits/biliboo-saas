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
      
      // Réessayer plusieurs fois pour récupérer l'utilisateur (la session peut mettre du temps à se synchroniser)
      let user = null;
      let userError = null;
      let retries = 0;
      const maxUserRetries = 5;
      
      while (retries < maxUserRetries && !user) {
        const { data: { user: currentUser }, error: currentError } = await supabase.auth.getUser();
        
        if (currentUser && !currentError) {
          user = currentUser;
          console.log(`✅ Utilisateur récupéré à la tentative ${retries + 1}/${maxUserRetries}`);
          break;
        }
        
        userError = currentError;
        retries++;
        
        if (retries < maxUserRetries) {
          console.warn(`⚠️ Tentative ${retries + 1}/${maxUserRetries} de récupération de l'utilisateur (avant soumission)...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Si on n'a toujours pas d'utilisateur après plusieurs tentatives, continuer quand même
      // Le backend vérifiera la session lors de la mise à jour
      if (!user) {
        console.warn('⚠️ Session non disponible après plusieurs tentatives, mais continuons quand même');
        console.warn('   Le backend vérifiera la session lors de la mise à jour des métadonnées');
        // Ne pas bloquer l'utilisateur, continuer avec la soumission
        // Si la session est vraiment expirée, l'erreur viendra du backend et on la gérera
      }

      if (user) {
        console.log('✅ Utilisateur authentifié:', user.email);
      } else {
        console.warn('⚠️ Pas d\'utilisateur disponible, mais tentative de mise à jour quand même');
      }

      // Mettre à jour les métadonnées avec les réponses
      // Si user est null, Supabase essaiera quand même de mettre à jour avec la session dans les cookies
      const { error, data: updateData } = await supabase.auth.updateUser({
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
        console.error('❌ Détails erreur:', {
          message: error.message,
          status: error.status,
          name: error.name
        });
        
        // Pour TOUTES les erreurs, réessayer plusieurs fois avec des délais
        // Cela permet de gérer les erreurs temporaires de synchronisation
        let retryCount = 0;
        const maxRetries = 3;
        let lastError = error;
        let success = false;
        
        while (retryCount < maxRetries && !success) {
          retryCount++;
          console.warn(`⚠️ Tentative ${retryCount}/${maxRetries} de mise à jour des métadonnées...`);
          
          // Attendre avant de réessayer (délai progressif)
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
          
          // Réessayer la mise à jour
          const { error: retryError } = await supabase.auth.updateUser({
            data: {
              onboarding_completed: true,
              onboarding_responses: answers,
              profile: answers['profile']?.[0],
              volume: answers['volume']?.[0],
              situation: answers['situation'],
              acquisition: answers['acquisition']?.[0],
            },
          });
          
          if (!retryError) {
            console.log(`✅ Métadonnées mises à jour avec succès à la tentative ${retryCount}`);
            success = true;
            break;
          }
          
          lastError = retryError;
          console.warn(`⚠️ Tentative ${retryCount} échouée:`, retryError.message);
        }
        
        // Si toutes les tentatives ont échoué, continuer quand même
        // Le middleware ou le dashboard vérifiera la session
        // NE PAS bloquer l'utilisateur avec une alerte
        if (!success) {
          console.warn('⚠️ Toutes les tentatives ont échoué, mais continuons quand même');
          console.warn('   Le middleware vérifiera la session lors de l\'accès au dashboard');
          // Les métadonnées peuvent être partiellement sauvegardées
          // On continue le flux normal
        }
      } else {
        console.log('✅ Métadonnées mises à jour avec succès');
      }

      console.log('✅ Onboarding complété, redirection vers dashboard');
      
      // Attendre un peu pour que les métadonnées soient bien synchronisées
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Rafraîchir la session pour s'assurer qu'elle est à jour
      try {
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && session) {
          console.log('✅ Session rafraîchie');
        }
      } catch (refreshErr) {
        console.warn('⚠️ Erreur lors du rafraîchissement de session (non bloquant):', refreshErr);
      }
      
      // Vérifier que l'utilisateur est toujours connecté avant de rediriger
      // Réessayer plusieurs fois en cas d'erreur temporaire
      let finalUser = null;
      let finalError = null;
      let finalRetries = 0;
      const maxFinalUserRetries = 5; // Augmenter le nombre de tentatives
      
      while (finalRetries < maxFinalUserRetries && !finalUser) {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (user && !error) {
          finalUser = user;
          console.log(`✅ Utilisateur récupéré à la tentative ${finalRetries + 1}/${maxFinalUserRetries}`);
          break;
        }
        
        finalError = error;
        finalRetries++;
        
        if (finalRetries < maxFinalUserRetries) {
          console.warn(`⚠️ Tentative ${finalRetries + 1}/${maxFinalUserRetries} de récupération de l'utilisateur...`);
          // Augmenter le délai entre les tentatives
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
      
      if (!finalUser) {
        console.error('❌ Utilisateur non authentifié après onboarding après plusieurs tentatives:', finalError);
        // En cas d'échec, rediriger quand même vers le dashboard
        // Le middleware gérera la redirection vers login si nécessaire
        console.warn('⚠️ Redirection vers dashboard malgré l\'erreur (le middleware gérera la session)');
        // Utiliser window.location.replace pour éviter que l'utilisateur puisse revenir en arrière
        window.location.replace('/dashboard');
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
        // Attendre un peu après la mise à jour
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('✅ Utilisateur vérifié, redirection vers dashboard');
      console.log('📧 Détails utilisateur:', {
        id: finalUser.id,
        email: finalUser.email,
        onboarding_completed: finalUser.user_metadata?.onboarding_completed,
        email_confirmed_at: finalUser.email_confirmed_at
      });
      
      // IMPORTANT: Forcer une dernière synchronisation des cookies avant redirection
      // Le middleware lit les cookies depuis la requête HTTP, il faut s'assurer qu'ils sont à jour
      try {
        // Rafraîchir une dernière fois pour forcer la mise à jour des cookies
        const { data: { session: finalSession }, error: finalRefreshError } = await supabase.auth.refreshSession();
        if (finalRefreshError) {
          console.warn('⚠️ Erreur lors du dernier rafraîchissement (non bloquant):', finalRefreshError);
        } else if (finalSession) {
          console.log('✅ Session et cookies synchronisés avant redirection');
        }
        
        // Attendre un peu pour que les cookies soient bien écrits dans le navigateur
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Vérifier une dernière fois que la session est toujours valide
        const { data: { user: lastCheck }, error: lastCheckError } = await supabase.auth.getUser();
        if (!lastCheck || lastCheckError) {
          console.error('❌ Session perdue avant redirection, réessayant...');
          // Réessayer une fois de plus
          await new Promise(resolve => setTimeout(resolve, 2000));
          const { data: { user: retryCheck } } = await supabase.auth.getUser();
          if (!retryCheck) {
            console.error('❌ Impossible de récupérer la session, redirection quand même');
          }
        }
      } catch (syncError) {
        console.warn('⚠️ Erreur lors de la synchronisation finale (non bloquant):', syncError);
      }
      
      // Rediriger vers le dashboard
      // Utiliser window.location.replace pour forcer une navigation complète
      // Cela permet au middleware de voir les cookies de session mis à jour
      // replace() empêche aussi l'utilisateur de revenir en arrière avec le bouton retour
      window.location.replace('/dashboard');
    } catch (error) {
      console.error('❌ Erreur lors de la soumission de l\'onboarding:', error);
      // Ne pas afficher d'alerte pour éviter de perturber l'expérience utilisateur
      // Le flux continue vers le dashboard même en cas d'erreur
      // Le middleware vérifiera la session et redirigera si nécessaire
      console.warn('⚠️ Redirection vers dashboard malgré l\'erreur (non bloquant)');
      // Attendre un peu avant de rediriger pour laisser le temps aux logs d'être enregistrés
      await new Promise(resolve => setTimeout(resolve, 500));
      window.location.replace('/dashboard');
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
