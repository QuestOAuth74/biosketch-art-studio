import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, RefreshCw } from "lucide-react";
import {
  useIOLogOperations,
  useIOLogGroupedBySource,
  useIOLogOperationTypes,
  useIOLogTableNames,
  type IOLogFilters,
  type IOLogEntry,
  type IOLogAggregated,
} from "@/hooks/useIODiagnostics";
import { exportToCSV, generateCSVFilename } from "@/lib/csvExport";

const IODiagnostics = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<IOLogFilters>({});
  const [sortColumn, setSortColumn] = useState<string>("timestamp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Redirect to home if not in development mode
  useEffect(() => {
    if (!import.meta.env.DEV) {
      navigate("/");
    }
  }, [navigate]);

  // Data fetching
  const {
    data: operations,
    isLoading: operationsLoading,
    refetch: refetchOperations,
  } = useIOLogOperations(filters);

  const {
    data: groupedData,
    isLoading: groupedLoading,
    refetch: refetchGrouped,
  } = useIOLogGroupedBySource();

  const { data: operationTypes } = useIOLogOperationTypes();
  const { data: tableNames } = useIOLogTableNames();

  // Don't render anything if redirecting
  if (!import.meta.env.DEV) {
    return null;
  }

  // Sorting function for operations table
  const sortedOperations = operations ? [...operations].sort((a, b) => {
    let aVal: any = a[sortColumn as keyof IOLogEntry];
    let bVal: any = b[sortColumn as keyof IOLogEntry];

    // Handle null values
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    // String comparison
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    // Number comparison
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }

    return 0;
  }) : [];

  // Handle column header click for sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Export operations to CSV
  const handleExportOperations = () => {
    if (!operations || operations.length === 0) return;

    const csvData = operations.map(op => ({
      Timestamp: format(new Date(op.timestamp), "yyyy-MM-dd HH:mm:ss"),
      Type: op.operation_type,
      Table: op.table_name || "N/A",
      "Size (KB)": op.data_size_kb?.toFixed(2) || "0",
      "Duration (ms)": op.duration_ms?.toFixed(2) || "N/A",
      Source: op.source,
      Error: op.error || "N/A",
    }));

    exportToCSV(csvData, generateCSVFilename("io-diagnostics-operations"));
  };

  // Export grouped data to CSV
  const handleExportGrouped = () => {
    if (!groupedData || groupedData.length === 0) return;

    const csvData = groupedData.map(item => ({
      Source: item.source,
      Count: item.count,
      "Total (MB)": item.total_mb.toFixed(2),
      "Avg Duration (ms)": item.avg_duration_ms?.toFixed(2) || "N/A",
    }));

    exportToCSV(csvData, generateCSVFilename("io-diagnostics-grouped"));
  };

  // Manual refresh
  const handleRefresh = () => {
    refetchOperations();
    refetchGrouped();
  };

  // Get badge color for operation type
  const getOperationBadgeColor = (type: string) => {
    switch (type) {
      case "SELECT":
        return "bg-blue-500";
      case "INSERT":
        return "bg-green-500";
      case "UPDATE":
        return "bg-yellow-500";
      case "DELETE":
        return "bg-red-500";
      case "UPSERT":
        return "bg-purple-500";
      case "RPC":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl font-bold">
                Database I/O Diagnostics
              </CardTitle>
              <CardDescription className="mt-2">
                Development-only tool to track and analyze database operations
              </CardDescription>
            </div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="operations" className="space-y-4">
            <TabsList>
              <TabsTrigger value="operations">Operations Table</TabsTrigger>
              <TabsTrigger value="grouped">Group by Source</TabsTrigger>
            </TabsList>

            {/* Operations Table Tab */}
            <TabsContent value="operations" className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4 items-center flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Select
                    value={filters.operationType || "all"}
                    onValueChange={(value) =>
                      setFilters({
                        ...filters,
                        operationType: value === "all" ? undefined : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by operation type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Operations</SelectItem>
                      {operationTypes?.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <Select
                    value={filters.tableName || "all"}
                    onValueChange={(value) =>
                      setFilters({
                        ...filters,
                        tableName: value === "all" ? undefined : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by table" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tables</SelectItem>
                      {tableNames?.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleExportOperations}
                  variant="outline"
                  disabled={!operations || operations.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>

              {/* Operations Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("timestamp")}
                      >
                        Timestamp {sortColumn === "timestamp" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("operation_type")}
                      >
                        Type {sortColumn === "operation_type" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("table_name")}
                      >
                        Table {sortColumn === "table_name" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted text-right"
                        onClick={() => handleSort("data_size_kb")}
                      >
                        Size (KB) {sortColumn === "data_size_kb" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted text-right"
                        onClick={() => handleSort("duration_ms")}
                      >
                        Duration (ms) {sortColumn === "duration_ms" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => handleSort("source")}
                      >
                        Source {sortColumn === "source" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operationsLoading ? (
                      // Loading skeleton
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        </TableRow>
                      ))
                    ) : sortedOperations && sortedOperations.length > 0 ? (
                      sortedOperations.map((op) => (
                        <TableRow key={op.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(op.timestamp), "yyyy-MM-dd HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            <Badge className={getOperationBadgeColor(op.operation_type)}>
                              {op.operation_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {op.table_name || "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {op.data_size_kb?.toFixed(2) || "0.00"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {op.duration_ms?.toFixed(2) || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs truncate max-w-md">
                            {op.source}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No operations recorded yet. Start using the app to see database activity.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {sortedOperations && sortedOperations.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Showing {sortedOperations.length} operations (last 1000)
                </p>
              )}
            </TabsContent>

            {/* Group by Source Tab */}
            <TabsContent value="grouped" className="space-y-4">
              <div className="flex justify-end">
                <Button
                  onClick={handleExportGrouped}
                  variant="outline"
                  disabled={!groupedData || groupedData.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>

              {/* Grouped Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Total (MB)</TableHead>
                      <TableHead className="text-right">Avg Duration (ms)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedLoading ? (
                      // Loading skeleton
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        </TableRow>
                      ))
                    ) : groupedData && groupedData.length > 0 ? (
                      groupedData.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-xs">
                            {item.source}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.count}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.total_mb.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.avg_duration_ms?.toFixed(2) || "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No data available. Start using the app to see database activity.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {groupedData && groupedData.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Showing {groupedData.length} unique sources
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default IODiagnostics;
