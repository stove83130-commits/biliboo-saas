"use client"

import type React from "react"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Mail, Phone, CheckCircle, ArrowRight } from "lucide-react"
import { Header } from "@/components/sections/header"
import { FooterSection } from "@/components/sections/footer-section"

function ContactPageContent() {
  const searchParams = useSearchParams()
  const planParam = searchParams?.get('plan')
  const trialParam = searchParams?.get('trial')
  
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    company: "",
    jobTitle: "",
    useCase: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // Validation
    if (!formData.email || !formData.firstName || !formData.lastName || !formData.company || !formData.jobTitle || !formData.useCase) {
      setErrorMessage('Veuillez remplir tous les champs obligatoires')
      setSubmitStatus('error')
      return
    }

    setIsSubmitting(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setSubmitStatus('success')
        // Réinitialiser le formulaire
        setFormData({
          email: "",
          firstName: "",
          lastName: "",
          phone: "",
          company: "",
          jobTitle: "",
          useCase: "",
        })
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }))
        setErrorMessage(errorData.error || 'Erreur lors de l\'envoi du formulaire')
        setSubmitStatus('error')
      }
    } catch (error: any) {
      setErrorMessage('Erreur réseau lors de l\'envoi du formulaire')
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/40 to-white flex flex-col">
      {/* Header */}
      <div className="w-full max-w-[1320px] mx-auto px-4 lg:px-6 pt-4 pb-6 z-10">
        <Header />
      </div>
      
      {/* Main Content */}
      <div className="flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Left Section - Info */}
        <div className="bg-emerald-500 px-8 lg:px-12 py-16 lg:py-24 flex flex-col justify-between">
          <div>
            <h1 className="text-5xl lg:text-6xl font-bold text-white mb-8 leading-tight">Contact</h1>
            <p className="text-lg text-emerald-50 mb-12 leading-relaxed">
              Contactez notre équipe pour une démonstration personnalisée de Bilibou. Découvrez comment automatiser
              votre gestion de factures avec l'IA.
            </p>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-400">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">Réponse dans 24h</h3>
                  <p className="text-sm text-emerald-50">
                    Notre équipe vous recontactera pour discuter de vos besoins spécifiques.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-400">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">Démonstration gratuite</h3>
                  <p className="text-sm text-emerald-50">
                    Voyez comment Bilibou peut transformer votre processus comptable.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-400">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">Support dédié</h3>
                  <p className="text-sm text-emerald-50">
                    Accédez à nos experts pour maximiser votre ROI dès le départ.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - Form */}
        <div className="bg-white px-8 lg:px-12 py-16 lg:py-24 flex items-center justify-center">
          <div className="w-full max-w-xl p-8 border-2 border-emerald-200 rounded-2xl bg-white/50">
            {submitStatus === 'success' ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Message envoyé !</h2>
                <p className="text-gray-600 mb-6">
                  Merci pour votre intérêt. Notre équipe vous recontactera dans les 24 heures.
                </p>
                <button
                  onClick={() => setSubmitStatus('idle')}
                  className="text-emerald-600 hover:text-emerald-700 font-semibold"
                >
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  {planParam === 'entreprise' ? 'Demander une démo Entreprise' : 'Démarrer gratuitement'}
                </h2>
                <p className="text-gray-600 mb-8">
                  {planParam === 'entreprise' 
                    ? 'Remplissez ce formulaire pour discuter d\'une solution Entreprise personnalisée.'
                    : 'Remplissez ce formulaire pour accéder à une démo personnalisée.'}
                  {trialParam && ' Un essai gratuit de 7 jours vous sera offert.'}
                </p>

                {submitStatus === 'error' && errorMessage && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    {errorMessage}
                  </div>
                )}

                {/* Email Field */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Email professionnel <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="vous@entreprise.com"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  />
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Prénom <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="Jean"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Nom <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Dupont"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Phone Field */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Numéro de téléphone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+33 1 23 45 67 89"
                    className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  />
                </div>

                {/* Company Field */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Entreprise <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    placeholder="Votre entreprise"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  />
                </div>

                {/* Job Title Field */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Fonction <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="jobTitle"
                    value={formData.jobTitle}
                    onChange={handleInputChange}
                    placeholder="Responsable comptabilité"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  />
                </div>

                {/* Use Case Field */}
                <div className="mb-8">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Vous êtes intéressé par <span className="text-emerald-600">*</span>
                  </label>
                  <select
                    name="useCase"
                    value={formData.useCase}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition appearance-none"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23059669' strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M2 5l6 6 6-6'/%3e%3c/svg%3e")`,
                      backgroundPosition: "right 0.75rem center",
                      backgroundRepeat: "no-repeat",
                      backgroundSize: "1.5em 1.5em",
                      paddingRight: "2.5rem",
                    }}
                  >
                    <option value="">Sélectionnez une option</option>
                    <option value="invoice-extraction">Extraction de factures</option>
                    <option value="automation">Automatisation comptable</option>
                    <option value="team-collaboration">Collaboration d'équipe</option>
                    <option value="export">Export et intégration</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-full transition duration-200 flex items-center justify-center gap-2 group"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      Commencer gratuitement maintenant
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 mt-4 text-center">
                  Nous respectons votre confidentialité. Vos données ne seront jamais partagées.
                </p>
              </form>
            )}
          </div>
        </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-auto">
        <FooterSection />
      </div>
    </div>
  )
}

export default function ContactPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-white via-emerald-50/40 to-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    }>
      <ContactPageContent />
    </Suspense>
  )
}
