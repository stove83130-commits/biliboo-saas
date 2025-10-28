'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  getPlan,
  canAddEmailAccount,
  canCreateOrganization,
  canUseAutoExport,
  getMaxInvoices,
  type Plan,
} from '@/lib/billing/plans';

interface PlanPermissions {
  plan: Plan | null;
  canAddEmail: boolean;
  canCreateOrg: boolean;
  canAutoExport: boolean;
  maxInvoices: number;
  isLoading: boolean;
  error: string | null;
}

export function usePlanPermissions() {
  const [permissions, setPermissions] = useState<PlanPermissions>({
    plan: null,
    canAddEmail: false,
    canCreateOrg: false,
    canAutoExport: false,
    maxInvoices: 0,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const supabase = createClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
          setPermissions(prev => ({
            ...prev,
            isLoading: false,
            error: 'Utilisateur non authentifié',
          }));
          return;
        }

        const planId = user.user_metadata?.selected_plan;
        const plan = getPlan(planId);

        // Compter le nombre d'emails et d'organisations
        const { data: emailAccounts } = await supabase
          .from('email_accounts')
          .select('id', { count: 'exact', head: true });

        const { data: organizations } = await supabase
          .from('workspaces')
          .select('id', { count: 'exact', head: true })
          .eq('type', 'organization');

        const emailCount = emailAccounts?.length || 0;
        const orgCount = organizations?.length || 0;

        setPermissions({
          plan,
          canAddEmail: canAddEmailAccount(planId, emailCount),
          canCreateOrg: canCreateOrganization(planId, orgCount),
          canAutoExport: canUseAutoExport(planId),
          maxInvoices: getMaxInvoices(planId),
          isLoading: false,
          error: null,
        });
      } catch (err) {
        console.error('Erreur lors de la récupération des permissions:', err);
        setPermissions(prev => ({
          ...prev,
          isLoading: false,
          error: 'Erreur lors de la récupération des permissions',
        }));
      }
    };

    fetchPermissions();
  }, []);

  return permissions;
}

