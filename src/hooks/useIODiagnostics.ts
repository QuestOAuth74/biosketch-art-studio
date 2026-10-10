import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type IOLogEntry = Tables<"dev_io_log">;

export interface IOLogFilters {
  dateRange?: [Date, Date];
  operationType?: string;
  tableName?: string;
}

export interface IOLogAggregated {
  source: string;
  count: number;
  total_mb: number;
  avg_duration_ms: number | null;
}

/**
 * Fetch last 1000 operations from dev_io_log table
 */
export function useIOLogOperations(filters?: IOLogFilters) {
  return useQuery({
    queryKey: ['io-diagnostics', 'operations', filters],
    queryFn: async () => {
      let query = supabase
        .from('dev_io_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000);

      // Apply filters
      if (filters?.dateRange) {
        const [start, end] = filters.dateRange;
        query = query
          .gte('timestamp', start.toISOString())
          .lte('timestamp', end.toISOString());
      }

      if (filters?.operationType && filters.operationType !== 'all') {
        query = query.eq('operation_type', filters.operationType);
      }

      if (filters?.tableName && filters.tableName !== 'all') {
        query = query.eq('table_name', filters.tableName);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch IO log operations: ${error.message}`);
      }

      return data as IOLogEntry[];
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Auto-refresh every 60 seconds
    enabled: import.meta.env.DEV, // Only run in development mode
  });
}

/**
 * Fetch aggregated data grouped by source function
 */
export function useIOLogGroupedBySource() {
  return useQuery({
    queryKey: ['io-diagnostics', 'grouped-by-source'],
    queryFn: async () => {
      // Since Supabase doesn't support complex aggregations in the query builder,
      // we'll fetch all data and aggregate client-side
      const { data, error } = await supabase
        .from('dev_io_log')
        .select('source, data_size_kb, duration_ms');

      if (error) {
        throw new Error(`Failed to fetch IO log for aggregation: ${error.message}`);
      }

      // Aggregate data by source
      const aggregated = data.reduce((acc, row) => {
        const source = row.source || 'unknown';

        if (!acc[source]) {
          acc[source] = {
            source,
            count: 0,
            total_kb: 0,
            total_duration_ms: 0,
            duration_count: 0,
          };
        }

        acc[source].count++;
        acc[source].total_kb += row.data_size_kb || 0;

        if (row.duration_ms !== null) {
          acc[source].total_duration_ms += row.duration_ms;
          acc[source].duration_count++;
        }

        return acc;
      }, {} as Record<string, {
        source: string;
        count: number;
        total_kb: number;
        total_duration_ms: number;
        duration_count: number;
      }>);

      // Convert to array and calculate final metrics
      const result: IOLogAggregated[] = Object.values(aggregated).map(item => ({
        source: item.source,
        count: item.count,
        total_mb: item.total_kb / 1024, // Convert KB to MB
        avg_duration_ms: item.duration_count > 0
          ? item.total_duration_ms / item.duration_count
          : null,
      }));

      // Sort by total MB descending
      result.sort((a, b) => b.total_mb - a.total_mb);

      return result;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Auto-refresh every 60 seconds
    enabled: import.meta.env.DEV, // Only run in development mode
  });
}

/**
 * Get unique operation types for filter dropdown
 */
export function useIOLogOperationTypes() {
  return useQuery({
    queryKey: ['io-diagnostics', 'operation-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dev_io_log')
        .select('operation_type')
        .order('operation_type');

      if (error) {
        throw new Error(`Failed to fetch operation types: ${error.message}`);
      }

      // Get unique operation types
      const unique = Array.from(new Set(data.map(row => row.operation_type)));
      return unique.filter(Boolean) as string[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (operation types don't change often)
    enabled: import.meta.env.DEV,
  });
}

/**
 * Get unique table names for filter dropdown
 */
export function useIOLogTableNames() {
  return useQuery({
    queryKey: ['io-diagnostics', 'table-names'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dev_io_log')
        .select('table_name')
        .order('table_name');

      if (error) {
        throw new Error(`Failed to fetch table names: ${error.message}`);
      }

      // Get unique table names
      const unique = Array.from(new Set(data.map(row => row.table_name)));
      return unique.filter(Boolean) as string[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: import.meta.env.DEV,
  });
}
