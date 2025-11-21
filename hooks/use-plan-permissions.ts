'use client';

import { useState } from 'react';
import { type Plan } from '@/lib/billing/plans';

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
  // VERSION DÉSACTIVÉE TEMPORAIREMENT
  return {
    plan: null,
    canAddEmail: true, // Tout autorisé temporairement
    canCreateOrg: true,
    canAutoExport: true,
    maxInvoices: 9999,
    isLoading: false,
    error: null,
  };
}
