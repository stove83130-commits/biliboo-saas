'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Download } from 'lucide-react';

interface InvoiceDetails {
  id: string;
  amount: number;
  currency: string;
  supplier_name: string | null;
  vendor_address: string | null;
  vendor_city: string | null;
  vendor_country: string | null;
  vendor_phone: string | null;
  vendor_email: string | null;
  vendor_website: string | null;
  customer_name: string | null;
  customer_address: string | null;
  customer_city: string | null;
  customer_country: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_vat_number: string | null;
  invoice_date: string;
  due_date: string | null;
  payment_date: string | null;
  invoice_number: string | null;
  category: string;
  description: string | null;
  payment_method: string | null;
  payment_status: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  tax_rate: number | null;
  items: any[] | null;
  notes: string | null;
  original_file_url: string | null;
  original_file_name: string | null;
  original_mime_type: string | null;
}

export default function InvoiceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInvoice();
  }, [params.id]);

  async function loadInvoice() {
    try {
      console.log(`🔍 Chargement facture ID: ${params.id}`);
      const response = await fetch(`/api/invoices/${params.id}`);
      const data = await response.json();
      
      console.log('📦 Réponse API:', data);
      
      if (!response.ok || !data.success) {
        console.error('❌ Erreur API:', data.error || 'Erreur inconnue');
        alert(`Erreur: ${data.error || 'Impossible de charger la facture'}`);
        return;
      }
      
      if (data.invoice) {
        console.log('✅ Facture chargée:', data.invoice.id);
        setInvoice(data.invoice);
      } else {
        console.error('❌ Pas de facture dans la réponse');
      }
    } catch (error) {
      console.error('❌ Erreur chargement facture:', error);
      alert('Erreur lors du chargement de la facture');
    } finally {
      setLoading(false);
    }
  }

  async function saveInvoice() {
    if (!invoice) return;

    setSaving(true);
    try {
      await fetch(`/api/invoices/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice),
      });
      alert('✅ Facture sauvegardée');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('❌ Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: string, value: any) {
    setInvoice(prev => prev ? { ...prev, [field]: value } : null);
  }

  if (loading) {
    return <div className="p-8">Chargement...</div>;
  }

  if (!invoice) {
    return <div className="p-8">Facture introuvable</div>;
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <div className="w-full flex flex-col h-full p-6">
        {/* Header - FIXE */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <Button
            variant="ghost"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>

          <div className="flex gap-2">
            <Button
              onClick={saveInvoice}
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
            {invoice.original_file_url && (
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Télécharger
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[40%_60%] gap-6 flex-1 overflow-hidden min-h-0">
          {/* GAUCHE : DONNÉES EXTRAITES (MODIFIABLES) - SCROLLABLE - 40% */}
          <div className="space-y-6 overflow-y-auto pr-2 min-h-0">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Informations générales</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Fournisseur *</label>
                  <Input
                    value={invoice.supplier_name || ''}
                    onChange={(e) => updateField('supplier_name', e.target.value)}
                    placeholder="Nom de l'entreprise"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Montant *</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoice.amount}
                      onChange={(e) => updateField('amount', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Devise *</label>
                    <Select value={invoice.currency} onValueChange={(v) => updateField('currency', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Sous-total HT</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoice.subtotal || ''}
                      onChange={(e) => updateField('subtotal', parseFloat(e.target.value) || null)}
                      placeholder="Optionnel"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Montant TVA</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoice.tax_amount || ''}
                      onChange={(e) => updateField('tax_amount', parseFloat(e.target.value) || null)}
                      placeholder="Optionnel"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Taux TVA (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={invoice.tax_rate || ''}
                    onChange={(e) => updateField('tax_rate', parseFloat(e.target.value) || null)}
                    placeholder="Ex: 20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Numéro de facture</label>
                  <Input
                    value={invoice.invoice_number || ''}
                    onChange={(e) => updateField('invoice_number', e.target.value)}
                    placeholder="Ex: INV-2024-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Catégorie comptable *</label>
                  <Select value={invoice.category} onValueChange={(v) => updateField('category', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Salaires et charges sociales">💼 Salaires et charges sociales</SelectItem>
                      <SelectItem value="Loyer et charges locales">🏢 Loyer et charges locales</SelectItem>
                      <SelectItem value="Matières premières">📦 Matières premières</SelectItem>
                      <SelectItem value="Services externes (comptable, avocat, consultant)">👔 Services externes (comptable, avocat, consultant)</SelectItem>
                      <SelectItem value="Matériel informatique et logiciels">💻 Matériel informatique et logiciels</SelectItem>
                      <SelectItem value="Marketing et publicité">📢 Marketing et publicité</SelectItem>
                      <SelectItem value="Transports et déplacements">🚗 Transports et déplacements</SelectItem>
                      <SelectItem value="Énergie">⚡ Énergie</SelectItem>
                      <SelectItem value="Entretien et réparations">🔧 Entretien et réparations</SelectItem>
                      <SelectItem value="Assurances">🛡️ Assurances</SelectItem>
                      <SelectItem value="Frais bancaires et financiers">🏦 Frais bancaires et financiers</SelectItem>
                      <SelectItem value="Fournitures de bureau">📝 Fournitures de bureau</SelectItem>
                      <SelectItem value="Sous-traitance">🤝 Sous-traitance</SelectItem>
                      <SelectItem value="Télécommunications">📞 Télécommunications</SelectItem>
                      <SelectItem value="Formation et développement">🎓 Formation et développement</SelectItem>
                      <SelectItem value="Taxes et cotisations">💰 Taxes et cotisations</SelectItem>
                      <SelectItem value="Amortissements">📉 Amortissements</SelectItem>
                      <SelectItem value="Charges exceptionnelles">⚠️ Charges exceptionnelles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Dates</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date de facture *</label>
                  <Input
                    type="date"
                    value={invoice.invoice_date?.split('T')[0] || ''}
                    onChange={(e) => updateField('invoice_date', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Date d'échéance</label>
                  <Input
                    type="date"
                    value={invoice.due_date?.split('T')[0] || ''}
                    onChange={(e) => updateField('due_date', e.target.value || null)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Date de paiement</label>
                  <Input
                    type="date"
                    value={invoice.payment_date?.split('T')[0] || ''}
                    onChange={(e) => updateField('payment_date', e.target.value || null)}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Paiement</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Mode de paiement</label>
                  <Input
                    value={invoice.payment_method || ''}
                    onChange={(e) => updateField('payment_method', e.target.value)}
                    placeholder="Ex: Visa, PayPal, Virement"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Statut de paiement</label>
                  <Select 
                    value={invoice.payment_status || 'paid'} 
                    onValueChange={(v) => updateField('payment_status', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">✅ Payé</SelectItem>
                      <SelectItem value="pending">⏳ En attente</SelectItem>
                      <SelectItem value="overdue">⚠️ En retard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Coordonnées fournisseur</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Adresse</label>
                  <Input
                    value={invoice.vendor_address || ''}
                    onChange={(e) => updateField('vendor_address', e.target.value)}
                    placeholder="Adresse complète"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Ville</label>
                    <Input
                      value={invoice.vendor_city || ''}
                      onChange={(e) => updateField('vendor_city', e.target.value)}
                      placeholder="Ville"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Pays</label>
                    <Input
                      value={invoice.vendor_country || ''}
                      onChange={(e) => updateField('vendor_country', e.target.value)}
                      placeholder="Pays"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Téléphone</label>
                  <Input
                    value={invoice.vendor_phone || ''}
                    onChange={(e) => updateField('vendor_phone', e.target.value)}
                    placeholder="Numéro de téléphone"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <Input
                    type="email"
                    value={invoice.vendor_email || ''}
                    onChange={(e) => updateField('vendor_email', e.target.value)}
                    placeholder="email@entreprise.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Site web</label>
                  <Input
                    type="url"
                    value={invoice.vendor_website || ''}
                    onChange={(e) => updateField('vendor_website', e.target.value)}
                    placeholder="https://www.entreprise.com"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Coordonnées client (destinataire)</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom du client</label>
                  <Input
                    value={invoice.customer_name || ''}
                    onChange={(e) => updateField('customer_name', e.target.value)}
                    placeholder="Nom du client / entreprise"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Adresse</label>
                  <Input
                    value={invoice.customer_address || ''}
                    onChange={(e) => updateField('customer_address', e.target.value)}
                    placeholder="Adresse complète"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Ville</label>
                    <Input
                      value={invoice.customer_city || ''}
                      onChange={(e) => updateField('customer_city', e.target.value)}
                      placeholder="Ville"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Pays</label>
                    <Input
                      value={invoice.customer_country || ''}
                      onChange={(e) => updateField('customer_country', e.target.value)}
                      placeholder="Pays"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Téléphone</label>
                  <Input
                    value={invoice.customer_phone || ''}
                    onChange={(e) => updateField('customer_phone', e.target.value)}
                    placeholder="Numéro de téléphone"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <Input
                    type="email"
                    value={invoice.customer_email || ''}
                    onChange={(e) => updateField('customer_email', e.target.value)}
                    placeholder="email@client.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Numéro de TVA</label>
                  <Input
                    value={invoice.customer_vat_number || ''}
                    onChange={(e) => updateField('customer_vat_number', e.target.value)}
                    placeholder="Ex: FR12345678901"
                  />
                </div>
              </div>
            </Card>

              <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Articles / Services</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newItem = {
                      description: '',
                      quantity: 1,
                      unitPrice: 0,
                      total: 0
                    };
                    const currentItems = invoice.items || [];
                    updateField('items', [...currentItems, newItem]);
                  }}
                >
                  + Ajouter une ligne
                </Button>
              </div>
              
              {invoice.items && invoice.items.length > 0 ? (
                <div className="space-y-3">
                  {invoice.items.map((item: any, index: number) => {
                    const quantity = item.quantity || 0;
                    const unitPrice = item.unitPrice || 0;
                    const total = quantity * unitPrice;
                    
                    return (
                      <div key={index} className="border rounded-lg p-4 space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Nom du produit</label>
                          <Input
                            value={item.description || ''}
                            onChange={(e) => {
                              const updatedItems = [...(invoice.items || [])];
                              updatedItems[index] = { ...updatedItems[index], description: e.target.value };
                              updateField('items', updatedItems);
                            }}
                            placeholder="Nom du produit ou service"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">Quantité</label>
                            <Input
                              type="number"
                              step="0.01"
                              value={quantity}
                              onChange={(e) => {
                                const newQuantity = parseFloat(e.target.value) || 0;
                                const updatedItems = [...(invoice.items || [])];
                                updatedItems[index] = { 
                                  ...updatedItems[index], 
                                  quantity: newQuantity,
                                  total: newQuantity * (updatedItems[index].unitPrice || 0)
                                };
                                updateField('items', updatedItems);
                              }}
                              placeholder="1"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium mb-1">Prix unitaire ({invoice.currency || 'EUR'})</label>
                            <Input
                              type="number"
                              step="0.01"
                              value={unitPrice}
                              onChange={(e) => {
                                const newUnitPrice = parseFloat(e.target.value) || 0;
                                const updatedItems = [...(invoice.items || [])];
                                updatedItems[index] = { 
                                  ...updatedItems[index], 
                                  unitPrice: newUnitPrice,
                                  total: (updatedItems[index].quantity || 0) * newUnitPrice
                                };
                                updateField('items', updatedItems);
                              }}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="text-sm text-gray-600">
                            Total: <span className="font-semibold">{total.toFixed(2)} {invoice.currency || 'EUR'}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updatedItems = invoice.items?.filter((_: any, i: number) => i !== index) || [];
                              updateField('items', updatedItems);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                    </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-4">Aucun article pour le moment</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newItem = {
                        description: '',
                        quantity: 1,
                        unitPrice: 0,
                        total: 0
                      };
                      updateField('items', [newItem]);
                    }}
                  >
                    + Ajouter le premier article
                  </Button>
                </div>
              )}
              </Card>
          </div>

          {/* DROITE : PRÉVISUALISATION FICHIER - FIXE - 60% */}
          <div className="flex flex-col h-full min-h-0">
            <Card className="p-6 flex flex-col h-full min-h-0">
              <h2 className="text-xl font-semibold mb-4 flex-shrink-0">Document original</h2>
              
              {invoice.original_file_url ? (
                <div className="border rounded-lg overflow-hidden bg-gray-50 flex-1 flex flex-col min-h-0">
                  {/* PDF */}
                  {invoice.original_mime_type === 'application/pdf' && (
                    <div className="relative flex-1 flex flex-col min-h-0">
                      <iframe
                        src={invoice.original_file_url}
                        className="w-full h-full flex-1"
                        title="Facture PDF"
                      />
                      <a
                        href={invoice.original_file_url}
                        download={invoice.original_file_name || 'facture.pdf'}
                        className="absolute top-4 right-4 bg-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-100 transition-colors z-10"
                      >
                        📥 Télécharger PDF
                      </a>
                    </div>
                  )}
                  
                  {/* IMAGE */}
                  {invoice.original_mime_type?.startsWith('image/') && (
                    <div className="relative flex-1 flex flex-col min-h-0 overflow-auto">
                      <img
                        src={invoice.original_file_url}
                        alt="Facture"
                        className="w-full h-auto"
                      />
                      <a
                        href={invoice.original_file_url}
                        download={invoice.original_file_name || 'facture.jpg'}
                        className="absolute top-4 right-4 bg-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-100 transition-colors z-10"
                      >
                        📥 Télécharger Image
                      </a>
                    </div>
                  )}
                  
                  {/* HTML (email) */}
                  {invoice.original_mime_type === 'text/html' && (
                    <div className="relative flex-1 flex flex-col min-h-0">
                      <iframe
                        srcDoc={atob(invoice.original_file_url.split(',')[1])}
                        className="w-full h-full bg-white"
                        title="Email original"
                        sandbox="allow-same-origin"
                      />
                      <div className="absolute top-4 right-4 bg-blue-50 px-4 py-2 rounded-lg shadow-lg z-10">
                        📧 Email original
                      </div>
                    </div>
                  )}
                  
                  {/* Type non supporté */}
                  {!['application/pdf', 'text/html'].includes(invoice.original_mime_type || '') &&
                   !invoice.original_mime_type?.startsWith('image/') && (
                    <div className="p-8 text-center text-gray-500">
                      <div className="text-6xl mb-4">📄</div>
                      <p className="font-medium">Type de fichier: {invoice.original_mime_type}</p>
                      <p className="text-sm mt-2">{invoice.original_file_name}</p>
                      <Button
                        className="mt-4"
                        variant="outline"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = invoice.original_file_url!;
                          link.download = invoice.original_file_name || 'facture';
                          link.click();
                        }}
                      >
                        📥 Télécharger
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-12 text-center text-gray-400">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="font-medium">Aucun fichier original disponible</p>
                  <p className="text-sm mt-2">
                    Cette facture a été extraite d'un email sans pièce jointe
                  </p>
                  <p className="text-xs mt-4 text-gray-500">
                    ID Email: {invoice.emailId}
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}



