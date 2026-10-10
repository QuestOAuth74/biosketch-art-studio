import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin notification counts returned by the RPC function
 */
interface AdminNotificationCounts {
  pendingProjects: number;
  pendingTestimonials: number;
  pendingIconSubmissions: number;
  unreadMessages: number;
  totalFeedback: number;
}

/**
 * Hook to fetch admin notification counts with caching
 *
 * Replaces manual polling in AdminNotificationBell component.
 * Uses RPC function to batch 5 COUNT queries into 1 call.
 *
 * Caching Strategy:
 * - staleTime: 5 minutes (data is fresh for 5 min)
 * - refetchInterval: 5 minutes (background refresh)
 * - refetchOnWindowFocus: true (refresh when admin returns)
 * - Query deduplication: Multiple admins share cache
 *
 * Performance Impact:
 * - Reduces 5 queries -> 1 RPC call (80% network reduction)
 * - Reduces query frequency: 60s -> 5min (96% query reduction)
 * - With 5 admins: 25 queries/min -> 1 query/min
 *
 * @returns Query result with admin notification counts
 */
export const useAdminNotificationCounts = () => {
  return useQuery<AdminNotificationCounts>({
    queryKey: ['admin-notification-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_admin_notification_counts')
        .single();

      if (error) {
        console.error('Error fetching admin notification counts:', error);
        throw error;
      }

      // Transform database response to match component interface
      return {
        pendingProjects: data.pending_projects || 0,
        pendingTestimonials: data.pending_testimonials || 0,
        pendingIconSubmissions: data.pending_icons || 0,
        unreadMessages: data.unread_messages || 0,
        totalFeedback: data.unviewed_feedback || 0,
      };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in memory for 10 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    refetchOnWindowFocus: true, // Refresh when admin returns to tab
    refetchOnMount: 'always', // Always fetch on mount for fresh data
    retry: 3, // Retry failed queries 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
};
