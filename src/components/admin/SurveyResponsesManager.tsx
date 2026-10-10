import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Heart, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { exportToCSV, generateCSVFilename } from "@/lib/csvExport";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface SurveyResponse {
  id: string;
  user_id: string | null;
  q1_role: string | null;
  q1_role_other: string | null;
  q2_research_area: string | null;
  q2_research_area_other: string | null;
  q3_pay_for_tool: string | null;
  q4_preferred_tool: string | null;
  q4_preferred_tool_other: string | null;
  q5_cost_affected_quality: string | null;
  q6_biosketch_familiarity: string | null;
  q7_limitations: string[] | null;
  q7_limitations_other: string | null;
  q8_usage_contexts: string[] | null;
  q8_usage_contexts_other: string | null;
  q8_publication_link: string | null;
  q9_feature_ratings: Record<string, string> | null;
  q10_missing_icons: string | null;
  q11_open_source_importance: string | null;
  q12_willing_to_contribute: string[] | null;
  signed_letter: boolean | null;
  supporter_name: string | null;
  supporter_institution: string | null;
  supporter_role: string | null;
  supporter_country: string | null;
  supporter_email: string | null;
  supporter_comments: string | null;
  created_at: string | null;
}

const FEATURE_KEYS = [
  "icon_library",
  "icon_request",
  "figure_editor",
  "figure_templates",
  "abstract_builder",
  "export_options",
  "video_tutorials",
  "offline_version",
];

export const SurveyResponsesManager = () => {
  const [filterSigned, setFilterSigned] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: responses, isLoading } = useQuery({
    queryKey: ["admin-survey-responses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_survey_responses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as SurveyResponse[];
    },
  });

  const filtered = filterSigned
    ? (responses || []).filter((r) => r.signed_letter)
    : responses || [];

  const signedCount = (responses || []).filter((r) => r.signed_letter).length;

  const handleExportCSV = () => {
    if (!responses || responses.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }

    const csvData = responses.map((r) => {
      const flatRatings: Record<string, string> = {};
      FEATURE_KEYS.forEach((key) => {
        flatRatings[`q9_${key}`] = (r.q9_feature_ratings as Record<string, string>)?.[key] || "";
      });

      return {
        id: r.id,
        submitted_at: r.created_at || "",
        q1_role: r.q1_role || "",
        q1_role_other: r.q1_role_other || "",
        q2_research_area: r.q2_research_area || "",
        q2_research_area_other: r.q2_research_area_other || "",
        q3_pay_for_tool: r.q3_pay_for_tool || "",
        q4_preferred_tool: r.q4_preferred_tool || "",
        q4_preferred_tool_other: r.q4_preferred_tool_other || "",
        q5_cost_affected_quality: r.q5_cost_affected_quality || "",
        q6_biosketch_familiarity: r.q6_biosketch_familiarity || "",
        q7_limitations: Array.isArray(r.q7_limitations) ? r.q7_limitations.join("; ") : "",
        q7_limitations_other: r.q7_limitations_other || "",
        q8_usage_contexts: Array.isArray(r.q8_usage_contexts) ? r.q8_usage_contexts.join("; ") : "",
        q8_usage_contexts_other: r.q8_usage_contexts_other || "",
        q8_publication_link: r.q8_publication_link || "",
        ...flatRatings,
        q10_missing_icons: r.q10_missing_icons || "",
        q11_open_source_importance: r.q11_open_source_importance || "",
        q12_willing_to_contribute: Array.isArray(r.q12_willing_to_contribute) ? r.q12_willing_to_contribute.join("; ") : "",
        signed_letter: r.signed_letter ? "Yes" : "No",
        supporter_name: r.supporter_name || "",
        supporter_institution: r.supporter_institution || "",
        supporter_role: r.supporter_role || "",
        supporter_country: r.supporter_country || "",
        supporter_email: r.supporter_email || "",
        supporter_comments: r.supporter_comments || "",
      };
    });

    exportToCSV(csvData, generateCSVFilename("community-survey"));
    toast({ title: "CSV downloaded" });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading survey responses...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 text-sm">
          <span className="font-semibold text-foreground">{responses?.length || 0}</span>
          <span className="text-muted-foreground">Total Responses</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 text-sm">
          <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
          <span className="font-semibold text-foreground">{signedCount}</span>
          <span className="text-muted-foreground">Letters Signed</span>
        </div>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilterSigned(!filterSigned)}
          className="gap-1.5"
        >
          <Filter className="h-3.5 w-3.5" />
          {filterSigned ? "Show All" : "Signed Only"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Response list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No survey responses yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const isExpanded = expandedId === r.id;
            return (
              <Card key={r.id} className="overflow-hidden">
                <button
                  type="button"
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  {r.signed_letter && (
                    <Heart className="h-4 w-4 text-rose-500 fill-rose-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">
                        {r.q1_role || "No role specified"}
                      </span>
                      {r.q2_research_area && (
                        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                          {r.q2_research_area}
                        </span>
                      )}
                      {r.supporter_country && (
                        <span className="text-xs text-muted-foreground">
                          {r.supporter_country}
                        </span>
                      )}
                    </div>
                    {r.supporter_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.supporter_name}
                        {r.supporter_institution ? ` — ${r.supporter_institution}` : ""}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {r.created_at ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true }) : ""}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4 px-4 border-t border-border/40">
                    <div className="grid gap-3 text-sm mt-3">
                      <Detail label="Q1 — Role" value={r.q1_role} />
                      <Detail label="Q2 — Research Area" value={r.q2_research_area} />
                      <Detail label="Q3 — Pays for Tool" value={r.q3_pay_for_tool} />
                      <Detail label="Q4 — Preferred Tool" value={r.q4_preferred_tool} />
                      <Detail label="Q5 — Cost Affected Quality" value={r.q5_cost_affected_quality} />
                      <Detail label="Q6 — BioSketch Familiarity" value={r.q6_biosketch_familiarity} />
                      <Detail
                        label="Q7 — Limitations"
                        value={Array.isArray(r.q7_limitations) ? r.q7_limitations.join("; ") : null}
                      />
                      <Detail
                        label="Q8 — Usage Contexts"
                        value={Array.isArray(r.q8_usage_contexts) ? r.q8_usage_contexts.join("; ") : null}
                      />
                      {r.q8_publication_link && (
                        <Detail label="Publication Link" value={r.q8_publication_link} />
                      )}
                      {r.q9_feature_ratings && typeof r.q9_feature_ratings === "object" && (
                        <div>
                          <span className="font-medium text-muted-foreground">Q9 — Feature Ratings:</span>
                          <div className="mt-1 grid gap-1 pl-3">
                            {Object.entries(r.q9_feature_ratings as Record<string, string>).map(([k, v]) => (
                              <span key={k} className="text-foreground">
                                {k.replace(/_/g, " ")}: <span className="text-muted-foreground">{v}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <Detail label="Q10 — Missing Icons" value={r.q10_missing_icons} />
                      <Detail label="Q11 — Open Source Importance" value={r.q11_open_source_importance} />
                      <Detail
                        label="Q12 — Willing to Contribute"
                        value={Array.isArray(r.q12_willing_to_contribute) ? r.q12_willing_to_contribute.join("; ") : null}
                      />
                      {r.signed_letter && (
                        <div className="mt-2 p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
                          <span className="font-medium text-rose-600 text-xs uppercase tracking-wider">Letter of Support</span>
                          <div className="mt-1.5 grid gap-1">
                            <Detail label="Name" value={r.supporter_name} />
                            <Detail label="Institution" value={r.supporter_institution} />
                            <Detail label="Country" value={r.supporter_country} />
                            <Detail label="Email" value={r.supporter_email} />
                            <Detail label="Comments" value={r.supporter_comments} />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="font-medium text-muted-foreground">{label}:</span>{" "}
      <span className="text-foreground">{value}</span>
    </div>
  );
}
