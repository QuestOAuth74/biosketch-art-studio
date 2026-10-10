import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { useMemo } from "react";

interface UserRow {
  created_at: string;
  last_login_at: string | null;
  project_count: number;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function weekLabel(date: Date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  return start.toISOString().slice(0, 10);
}

export const RetentionAnalytics = () => {
  const { data: users, isLoading } = useQuery<UserRow[]>({
    queryKey: ["retention-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_analytics", {
        limit_count: 100000,
        offset_count: 0,
      });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        created_at: r.created_at,
        last_login_at: r.last_login_at,
        project_count: Number(r.project_count),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const metrics = useMemo(() => {
    if (!users || users.length === 0) return null;

    const now = new Date();
    let returnedDay1 = 0;
    let returnedDay7 = 0;
    let returnedDay30 = 0;
    let eligibleDay1 = 0;
    let eligibleDay7 = 0;
    let eligibleDay30 = 0;
    let activeNow = 0;
    let withProjects = 0;
    let dormant = 0;

    // Signup cohort buckets (by week)
    const cohortMap = new Map<string, { total: number; retained: number }>();

    // Activity recency buckets
    const recencyBuckets = [
      { label: "Today", max: 1, count: 0 },
      { label: "Last 7d", max: 7, count: 0 },
      { label: "Last 30d", max: 30, count: 0 },
      { label: "Last 90d", max: 90, count: 0 },
      { label: "90d+", max: Infinity, count: 0 },
      { label: "Never", max: -1, count: 0 },
    ];

    for (const u of users) {
      const signupDate = new Date(u.created_at);
      const daysSinceSignup = daysBetween(signupDate, now);

      const lastLogin = u.last_login_at ? new Date(u.last_login_at) : null;
      const daysSinceLogin = lastLogin ? daysBetween(lastLogin, now) : null;

      // Retention rates (only count users old enough)
      if (daysSinceSignup >= 1) {
        eligibleDay1++;
        if (lastLogin && daysBetween(signupDate, lastLogin) >= 1) returnedDay1++;
      }
      if (daysSinceSignup >= 7) {
        eligibleDay7++;
        if (lastLogin && daysBetween(signupDate, lastLogin) >= 7) returnedDay7++;
      }
      if (daysSinceSignup >= 30) {
        eligibleDay30++;
        if (lastLogin && daysBetween(signupDate, lastLogin) >= 30) returnedDay30++;
      }

      // Active in last 7 days
      if (daysSinceLogin !== null && daysSinceLogin <= 7) activeNow++;

      // Has projects
      if (u.project_count > 0) withProjects++;

      // Dormant: signed up 7+ days ago, never returned or no projects
      if (daysSinceSignup >= 7 && (u.project_count === 0 || daysSinceLogin === null || daysSinceLogin > 30)) {
        dormant++;
      }

      // Recency
      if (daysSinceLogin === null) {
        recencyBuckets[5].count++;
      } else if (daysSinceLogin < 1) {
        recencyBuckets[0].count++;
      } else if (daysSinceLogin < 7) {
        recencyBuckets[1].count++;
      } else if (daysSinceLogin < 30) {
        recencyBuckets[2].count++;
      } else if (daysSinceLogin < 90) {
        recencyBuckets[3].count++;
      } else {
        recencyBuckets[4].count++;
      }

      // Cohort by signup week
      const week = weekLabel(signupDate);
      const cohort = cohortMap.get(week) || { total: 0, retained: 0 };
      cohort.total++;
      if (lastLogin && daysBetween(signupDate, lastLogin) >= 7) {
        cohort.retained++;
      }
      cohortMap.set(week, cohort);
    }

    // Build cohort chart data (last 12 weeks)
    const cohortData = Array.from(cohortMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([week, { total, retained }]) => ({
        week: week.slice(5), // MM-DD format
        signups: total,
        retained,
        rate: total > 0 ? Math.round((retained / total) * 100) : 0,
      }));

    const pctDay1 = eligibleDay1 > 0 ? Math.round((returnedDay1 / eligibleDay1) * 100) : 0;
    const pctDay7 = eligibleDay7 > 0 ? Math.round((returnedDay7 / eligibleDay7) * 100) : 0;
    const pctDay30 = eligibleDay30 > 0 ? Math.round((returnedDay30 / eligibleDay30) * 100) : 0;
    const pctWithProjects = users.length > 0 ? Math.round((withProjects / users.length) * 100) : 0;

    return {
      total: users.length,
      activeNow,
      withProjects,
      dormant,
      pctDay1,
      pctDay7,
      pctDay30,
      pctWithProjects,
      recencyBuckets,
      cohortData,
    };
  }, [users]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8 text-muted-foreground">No user data available</div>
    );
  }

  return (
    <div className="space-y-6 mb-8">
      <div className="flex items-center gap-2.5">
        <span className="text-2xl">📈</span>
        <h2 className="text-xl font-bold">Retention & Conversion</h2>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Day 1 Retention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.pctDay1}%</div>
            <p className="text-xs text-muted-foreground">Returned after signup</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Day 7 Retention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.pctDay7}%</div>
            <p className="text-xs text-muted-foreground">Active after 1 week</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Day 30 Retention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.pctDay30}%</div>
            <p className="text-xs text-muted-foreground">Active after 1 month</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Created a Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.pctWithProjects}%</div>
            <p className="text-xs text-muted-foreground">{metrics.withProjects} of {metrics.total} users</p>
          </CardContent>
        </Card>
      </div>

      {/* Status overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.activeNow}</div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Dormant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{metrics.dormant}</div>
            <p className="text-xs text-muted-foreground">7d+ old, inactive 30d+</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Signup-to-Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pctWithProjects}%</div>
            <p className="text-xs text-muted-foreground">Conversion rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Last Activity Recency */}
        <Card className="border border-border/50 bg-background/80 backdrop-blur-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Last Activity Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.recencyBuckets}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "2px solid hsl(var(--foreground))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Cohort Retention */}
        <Card className="border border-border/50 bg-background/80 backdrop-blur-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Weekly Cohort Retention (7-day)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.cohortData.length > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.cohortData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis
                      unit="%"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "2px solid hsl(var(--foreground))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === "rate") return [`${value}%`, "Retention"];
                        if (name === "signups") return [value, "Signups"];
                        return [value, name];
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="hsl(142, 76%, 36%)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Not enough data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
