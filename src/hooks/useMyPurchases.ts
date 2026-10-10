import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CreditPurchase {
  id: string;
  stripe_session_id: string;
  amount_usd: number;
  generations_granted: number;
  created_at: string;
}

/**
 * Read the current user's purchase history from `ai_credit_purchases`.
 * RLS restricts rows to the caller (auth.uid() = user_id).
 */
export const useMyPurchases = () => {
  const { user } = useAuth();
  return useQuery<CreditPurchase[]>({
    queryKey: ['my-credit-purchases', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_credit_purchases')
        .select('id, stripe_session_id, amount_usd, generations_granted, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CreditPurchase[];
    },
  });
};
