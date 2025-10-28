'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const ONBOARDING_STEPS = [
  {
    id: 'profile',
    question: 'Quel est votre profil ?',
    subtitle: 'Choisissez celui qui vous correspond le mieux',
    options: [
      { value: 'auto-entrepreneur', label: 'Auto-entrepreneur', icon: '👤' },
      { value: 'ceo', label: 'CEO / Directeur général', icon: '💼' },
      { value: 'daf', label: 'Directeur administratif et financier', icon: '📊' },
      { value: 'comptable', label: 'Comptable / Expert-comptable', icon: '🔢' },
      { value: 'assistant', label: 'Assistant(e) administratif(ve)', icon: '📋' },
      { value: 'achats', label: 'Responsable des achats', icon: '🛒' },
      { value: 'autre', label: 'Autre', icon: '❓' },
    ],
  },
  {
    id: 'volume',
    question: 'Combien de factures recevez-vous par mois environ ?',
    subtitle: 'Cela nous aide à personnaliser votre expérience',
    options: [
      { value: 'moins-100', label: 'Moins de 100 factures', icon: '📄' },
      { value: '100-300', label: '100 à 300 factures', icon: '📑' },
      { value: '300-1200', label: '300 à 1 200 factures', icon: '📚' },
      { value: 'plus-1200', label: 'Plus de 1 200 factures', icon: '📦' },
      { value: 'je-ne-sais-pas', label: 'Je ne sais pas encore', icon: '🤷' },
    ],
  },
  {
    id: 'situation',
    question: 'Comment gérez-vous vos factures aujourd\'hui ?',
    subtitle: 'Sélectionnez toutes les options qui s\'appliquent',
    options: [
      { value: 'manuellement', label: 'Manuellement (emails, papier...)', icon: '✍️' },
      { value: 'logiciel-comptable', label: 'Avec un logiciel comptable', icon: '💻' },
      { value: 'excel', label: 'Avec Excel/Google Sheets', icon: '📊' },
      { value: 'comptable', label: 'Mon comptable s\'en occupe', icon: '👔' },
      { value: 'mix', label: 'Un mix de tout ça', icon: '🔄' },
    ],
    multiple: true,
  },
  {
    id: 'acquisition',
    question: 'Comment avez-vous découvert Bilibou ?',
    subtitle: 'Cela nous aide à améliorer nos canaux',
    options: [
      { value: 'google', label: 'Recherche Google', icon: '🔍' },
      { value: 'recommandation', label: 'Recommandation d\'un ami/collègue', icon: '👥' },
      { value: 'reseaux-sociaux', label: 'Réseaux sociaux', icon: '📱' },
      { value: 'presse', label: 'Article de blog / Presse', icon: '📰' },
      { value: 'publicite', label: 'Publicité en ligne', icon: '📢' },
      { value: 'comptable-reco', label: 'Mon comptable m\'a recommandé', icon: '💡' },
      { value: 'autre', label: 'Autre', icon: '❓' },
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
        setSelectedValues([]); // Reset pour la prochaine question
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
    if (!consent) return;

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.error('Utilisateur non authentifié');
        router.push('/auth/login');
        return;
      }

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
        console.error('Erreur lors de la sauvegarde:', error);
        alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
        return;
      }

      // Rediriger vers le dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Erreur:', error);
      alert('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = selectedValues.length > 0 || (isConsentStep && consent);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bienvenue sur Bilibou 👋
          </h1>
          <p className="text-gray-600">
            Gagnez des heures sur la gestion des factures : la configuration ne prend que 2 minutes !
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 ease-out"
              style={{ width: `${((currentStep + 1) / (ONBOARDING_STEPS.length + 1)) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2 text-center">
            Étape {currentStep + 1} sur {ONBOARDING_STEPS.length + 1}
          </p>
        </div>

        {/* Contenu */}
        <div className="min-h-[400px]">
          {!isConsentStep ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{step.question}</h2>
                <p className="text-sm text-gray-600">{step.subtitle}</p>
              </div>

              <div className="space-y-3">
                {step.options.map((option) => {
                  const isSelected = selectedValues.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleOptionClick(option.value)}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                      }`}
                    >
                      <span className="text-2xl">{option.icon}</span>
                      <span className="flex-1 font-medium text-gray-900">{option.label}</span>
                      {isSelected && (
                        <span className="text-blue-600">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Consentement et confidentialité</h2>
              <p className="text-sm text-gray-600 mb-4">
                Pour fonctionner, Bilibou a besoin d'accéder à vos emails de manière sécurisée pour extraire automatiquement vos factures.
              </p>

              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(checked) => setConsent(checked === true)}
                  className="mt-1"
                />
                <label htmlFor="consent" className="flex-1 text-sm text-gray-700 leading-relaxed cursor-pointer">
                  J'autorise Bilibou à accéder à mes emails de manière sécurisée pour extraire automatiquement mes factures. Mes données ne sont jamais partagées avec des tiers et sont traitées conformément à notre{' '}
                  <a href="/privacy" target="_blank" className="text-blue-600 hover:underline">
                    Politique de confidentialité
                  </a>{' '}
                  et aux{' '}
                  <a href="/terms" target="_blank" className="text-blue-600 hover:underline">
                    Conditions d'utilisation
                  </a>.
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Bouton continuer */}
        <div className="mt-8 flex justify-end">
          <Button
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            className="px-8 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Chargement...' : isConsentStep ? 'Terminer la configuration' : 'Continuer →'}
          </Button>
        </div>
      </div>
    </div>
  );
}
