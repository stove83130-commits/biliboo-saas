import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';


export const dynamic = 'force-dynamic'
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // 1. Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    console.log(`🔍 GET /api/invoices/${params.id} - User: ${user.id}`);

    // 2. Récupérer la facture
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('❌ Erreur GET invoice:', error);
      return NextResponse.json(
        { error: 'Facture introuvable', details: error },
        { status: 404 }
      );
    }

    console.log(`🔍 FACTURE CHARGÉE:
   ID: ${invoice.id}
   Vendor: ${invoice.vendor}
   Amount: ${invoice.amount} ${invoice.currency}
   EmailID: ${invoice.email_id}
   Fichier original:
      - Présent: ${invoice.original_file_url ? 'OUI ✅' : 'NON ❌'}
      - Type: ${invoice.original_mime_type || 'N/A'}
      - Nom: ${invoice.original_file_name || 'N/A'}
      - Taille: ${invoice.original_file_url ? '0 KB' : 'N/A'}`);

    console.log('✅ Données envoyées au frontend:', Object.keys(invoice));

    // Adapter les données pour le frontend
    const adaptedInvoice = {
      id: invoice.id,
      amount: invoice.amount || 0,
      currency: invoice.currency || 'EUR',
      supplier_name: invoice.vendor || null,
      vendor_address: invoice.vendor_address || null,
      vendor_city: invoice.vendor_city || null,
      vendor_country: invoice.vendor_country || null,
      vendor_phone: invoice.vendor_phone || null,
      vendor_email: invoice.vendor_email || null,
      vendor_website: invoice.vendor_website || null,
      customer_name: invoice.customer_name || null,
      customer_address: invoice.customer_address || null,
      customer_city: invoice.customer_city || null,
      customer_country: invoice.customer_country || null,
      customer_phone: invoice.customer_phone || null,
      customer_email: invoice.customer_email || null,
      customer_vat_number: invoice.customer_vat_number || null,
      invoice_date: invoice.date || new Date().toISOString(),
      due_date: invoice.due_date || null,
      payment_date: invoice.payment_date || null,
      invoice_number: invoice.invoice_number || null,
      category: invoice.category || 'Autre',
      description: invoice.description || null,
      payment_method: invoice.payment_method || null,
      payment_status: invoice.payment_status || null,
      subtotal: invoice.subtotal || null,
      tax_amount: invoice.tax_amount || null,
      tax_rate: invoice.tax_rate || null,
      items: invoice.items ? invoice.items.map((item: any) => ({
        description: item.description || '',
        quantity: item.quantity || 0,
        unitPrice: item.unitPrice || item.unit_price || 0, // Support both formats
        total: item.total || (item.quantity || 0) * (item.unitPrice || item.unit_price || 0),
      })) : null,
      notes: invoice.notes || null,
      original_file_url: invoice.original_file_url || null,
      original_file_name: invoice.original_file_name || null,
      original_mime_type: invoice.original_mime_type || null,
    };

    return NextResponse.json({
      success: true,
      invoice: adaptedInvoice,
    });
  } catch (error: any) {
    console.error('❌ Erreur serveur GET invoice:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // 1. Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // 2. Récupérer les données à mettre à jour
    const body = await request.json();

    console.log(`🔄 PATCH /api/invoices/${params.id} - User: ${user.id}`);
    console.log('📝 Données à mettre à jour:', Object.keys(body));

    // 3. Mapper les champs du frontend vers la base de données
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Mapping des champs (frontend -> DB)
    if (body.supplier_name !== undefined) updateData.vendor = body.supplier_name;
    if (body.amount !== undefined) updateData.amount = body.amount;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.invoice_date !== undefined) updateData.date = body.invoice_date;
    if (body.invoice_number !== undefined) updateData.invoice_number = body.invoice_number;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.payment_method !== undefined) updateData.payment_method = body.payment_method;
    if (body.payment_status !== undefined) updateData.payment_status = body.payment_status;
    if (body.vendor_address !== undefined) updateData.vendor_address = body.vendor_address;
    if (body.vendor_city !== undefined) updateData.vendor_city = body.vendor_city;
    if (body.vendor_country !== undefined) updateData.vendor_country = body.vendor_country;
    if (body.vendor_phone !== undefined) updateData.vendor_phone = body.vendor_phone;
    if (body.vendor_email !== undefined) updateData.vendor_email = body.vendor_email;
    if (body.vendor_website !== undefined) updateData.vendor_website = body.vendor_website;
    if (body.customer_name !== undefined) updateData.customer_name = body.customer_name;
    if (body.customer_address !== undefined) updateData.customer_address = body.customer_address;
    if (body.customer_city !== undefined) updateData.customer_city = body.customer_city;
    if (body.customer_country !== undefined) updateData.customer_country = body.customer_country;
    if (body.customer_phone !== undefined) updateData.customer_phone = body.customer_phone;
    if (body.customer_email !== undefined) updateData.customer_email = body.customer_email;
    if (body.customer_vat_number !== undefined) updateData.customer_vat_number = body.customer_vat_number;
    if (body.due_date !== undefined) updateData.due_date = body.due_date;
    if (body.payment_date !== undefined) updateData.payment_date = body.payment_date;
    if (body.subtotal !== undefined) updateData.subtotal = body.subtotal;
    if (body.tax_amount !== undefined) updateData.tax_amount = body.tax_amount;
    if (body.tax_rate !== undefined) updateData.tax_rate = body.tax_rate;
    if (body.items !== undefined) {
      // Normaliser les items : convertir unitPrice en unit_price pour la DB
      updateData.items = body.items.map((item: any) => ({
        description: item.description || '',
        quantity: item.quantity || 0,
        unit_price: item.unitPrice || item.unit_price || 0,
        total: item.total || (item.quantity || 0) * (item.unitPrice || item.unit_price || 0),
      }));
    }
    if (body.notes !== undefined) updateData.notes = body.notes;

    // 4. Mettre à jour la facture
    const { data: invoice, error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur PATCH invoice:', error);
      return NextResponse.json(
        { error: 'Erreur mise à jour', details: error },
        { status: 400 }
      );
    }

    console.log('✅ Facture mise à jour avec succès');

    return NextResponse.json({
      success: true,
      invoice,
    });
  } catch (error: any) {
    console.error('❌ Erreur serveur PATCH invoice:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // 1. Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    console.log(`🗑️ DELETE /api/invoices/${params.id} - User: ${user.id}`);

    // 2. Récupérer la facture pour obtenir le file_url
    const { data: invoice } = await supabase
      .from('invoices')
      .select('original_file_url')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    // 3. Supprimer le fichier du storage si présent
    if (invoice?.original_file_url) {
      await supabase.storage
        .from('invoices')
        .remove([invoice.original_file_url]);
    }

    // 4. Supprimer la facture de la base de données
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('❌ Erreur DELETE invoice:', error);
      return NextResponse.json(
        { error: 'Erreur suppression', details: error },
        { status: 400 }
      );
    }

    console.log('✅ Facture supprimée avec succès');

    return NextResponse.json({
      success: true,
      message: 'Facture supprimée',
    });
  } catch (error: any) {
    console.error('❌ Erreur serveur DELETE invoice:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}
