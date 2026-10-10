import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface SegmentedUser {
  id: string;
  email: string;
  full_name: string;
  country: string | null;
  field_of_study: string | null;
  created_at: string;
  last_login_at: string | null;
  project_count: number;
}

type Segment = "active" | "dormant" | "never-engaged";

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function segmentUser(u: SegmentedUser): Segment {
  const now = new Date();
  const lastLogin = u.last_login_at ? new Date(u.last_login_at) : null;
  const daysSinceLogin = lastLogin ? daysBetween(lastLogin, now) : null;

  // Never-engaged: 0 projects and either never logged in after signup or only logged in once
  if (u.project_count === 0 && (daysSinceLogin === null || daysSinceLogin > 7)) {
    return "never-engaged";
  }

  // Active: logged in within last 30 days
  if (daysSinceLogin !== null && daysSinceLogin <= 30) {
    return "active";
  }

  // Dormant: everything else (has projects or logged in, but inactive 30+ days)
  return "dormant";
}

const SEGMENT_INFO: Record<Segment, { label: string; description: string; color: string }> = {
  active: {
    label: "Active",
    description: "Logged in within the last 30 days",
    color: "text-green-600",
  },
  dormant: {
    label: "Dormant",
    description: "Has engaged before but inactive for 30+ days",
    color: "text-amber-600",
  },
  "never-engaged": {
    label: "Never Engaged",
    description: "Signed up but never created a project, inactive 7+ days",
    color: "text-red-600",
  },
};

const ITEMS_PER_PAGE = 25;

function exportSegmentToCSV(users: SegmentedUser[], segmentLabel: string) {
  const excelData = users.map((u, i) => ({
    "#": i + 1,
    "Full Name": u.full_name || "Not provided",
    Email: u.email,
    Country: u.country || "Not specified",
    "Field of Study": u.field_of_study || "Not specified",
    "Total Projects": u.project_count,
    "Join Date": format(new Date(u.created_at), "MMM dd, yyyy"),
    "Last Login": u.last_login_at
      ? format(new Date(u.last_login_at), "MMM dd, yyyy HH:mm")
      : "Never",
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  worksheet["!cols"] = [
    { wch: 5 },
    { wch: 25 },
    { wch: 35 },
    { wch: 20 },
    { wch: 25 },
    { wch: 15 },
    { wch: 15 },
    { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, segmentLabel);

  const timestamp = format(new Date(), "yyyy-MM-dd");
  XLSX.writeFile(workbook, `BioSketch_${segmentLabel.replace(/\s+/g, "_")}_${timestamp}.xlsx`);
}

export const UserSegmentation = () => {
  const [activeTab, setActiveTab] = useState<Segment>("active");
  const [pages, setPages] = useState<Record<Segment, number>>({
    active: 1,
    dormant: 1,
    "never-engaged": 1,
  });

  const { data: allUsers, isLoading } = useQuery<SegmentedUser[]>({
    queryKey: ["user-segmentation"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_analytics", {
        limit_count: 100000,
        offset_count: 0,
      });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        email: r.email,
        full_name: r.full_name,
        country: r.country,
        field_of_study: r.field_of_study,
        created_at: r.created_at,
        last_login_at: r.last_login_at,
        project_count: Number(r.project_count),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const segments = useMemo(() => {
    if (!allUsers) return { active: [], dormant: [], "never-engaged": [] };

    const result: Record<Segment, SegmentedUser[]> = {
      active: [],
      dormant: [],
      "never-engaged": [],
    };

    for (const u of allUsers) {
      result[segmentUser(u)].push(u);
    }

    // Sort each segment: active by last login desc, others by created_at desc
    result.active.sort((a, b) =>
      (b.last_login_at || "").localeCompare(a.last_login_at || "")
    );
    result.dormant.sort((a, b) =>
      (b.last_login_at || "").localeCompare(a.last_login_at || "")
    );
    result["never-engaged"].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );

    return result;
  }, [allUsers]);

  if (isLoading) {
    return (
      <Card className="border border-border/50 bg-background/80 backdrop-blur-sm rounded-xl">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const currentPage = pages[activeTab];
  const currentUsers = segments[activeTab];
  const totalPages = Math.ceil(currentUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = currentUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const setPage = (page: number) => {
    setPages((prev) => ({ ...prev, [activeTab]: page }));
  };

  return (
    <Card className="border border-border/50 bg-background/80 backdrop-blur-sm rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          User Segments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Users segmented by engagement level. Download any segment as a spreadsheet for targeted email campaigns.
        </p>

        {/* Segment summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {(["active", "dormant", "never-engaged"] as Segment[]).map((seg) => {
            const info = SEGMENT_INFO[seg];
            const count = segments[seg].length;
            const total = allUsers?.length || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div
                key={seg}
                className="border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => { setActiveTab(seg); setPages((p) => ({ ...p, [seg]: 1 })); }}
              >
                <p className="text-xs text-muted-foreground">{info.label}</p>
                <p className={`text-2xl font-bold ${info.color}`}>{count}</p>
                <p className="text-xs text-muted-foreground">{pct}% of users</p>
              </div>
            );
          })}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as Segment); setPages((p) => ({ ...p, [v as Segment]: 1 })); }}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="active" className="text-xs gap-1.5">
                Active <Badge variant="secondary" className="text-[10px] px-1.5">{segments.active.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="dormant" className="text-xs gap-1.5">
                Dormant <Badge variant="secondary" className="text-[10px] px-1.5">{segments.dormant.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="never-engaged" className="text-xs gap-1.5">
                Never Engaged <Badge variant="secondary" className="text-[10px] px-1.5">{segments["never-engaged"].length}</Badge>
              </TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              disabled={currentUsers.length === 0}
              onClick={() => exportSegmentToCSV(currentUsers, SEGMENT_INFO[activeTab].label)}
            >
              <Download className="h-3.5 w-3.5" />
              Download {SEGMENT_INFO[activeTab].label} ({currentUsers.length})
            </Button>
          </div>

          {(["active", "dormant", "never-engaged"] as Segment[]).map((seg) => (
            <TabsContent key={seg} value={seg} className="mt-4">
              <p className="text-xs text-muted-foreground mb-3">
                {SEGMENT_INFO[seg].description}
              </p>

              {currentUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No users in this segment.
                </div>
              ) : (
                <>
                  <div className="border rounded-md overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs sticky top-0 bg-background w-8">#</TableHead>
                          <TableHead className="text-xs sticky top-0 bg-background">Name</TableHead>
                          <TableHead className="text-xs sticky top-0 bg-background">Email</TableHead>
                          <TableHead className="text-xs sticky top-0 bg-background">Country</TableHead>
                          <TableHead className="text-xs sticky top-0 bg-background">Field</TableHead>
                          <TableHead className="text-xs sticky top-0 bg-background">Projects</TableHead>
                          <TableHead className="text-xs sticky top-0 bg-background">Signed Up</TableHead>
                          <TableHead className="text-xs sticky top-0 bg-background">Last Login</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedUsers.map((u, i) => (
                          <TableRow key={u.id} className="text-xs">
                            <TableCell className="text-muted-foreground">
                              {(currentPage - 1) * ITEMS_PER_PAGE + i + 1}
                            </TableCell>
                            <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{u.email}</TableCell>
                            <TableCell>{u.country || "—"}</TableCell>
                            <TableCell>{u.field_of_study || "—"}</TableCell>
                            <TableCell>{u.project_count}</TableCell>
                            <TableCell>
                              {u.created_at ? format(new Date(u.created_at), "MMM d, yyyy") : "—"}
                            </TableCell>
                            <TableCell>
                              {u.last_login_at
                                ? format(new Date(u.last_login_at), "MMM d, yyyy")
                                : <span className="text-destructive">Never</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-3">
                      <p className="text-xs text-muted-foreground">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, currentUsers.length)} of {currentUsers.length}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={currentPage === 1}
                          onClick={() => setPage(currentPage - 1)}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-xs px-2">
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={currentPage === totalPages}
                          onClick={() => setPage(currentPage + 1)}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};
