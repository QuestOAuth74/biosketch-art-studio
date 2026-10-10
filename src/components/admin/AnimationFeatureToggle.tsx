import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

export const AnimationFeatureToggle = () => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSetting();
  }, []);

  const fetchSetting = async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", "animation_feature")
        .single();

      if (error) throw error;

      if (data?.setting_value) {
        const value = data.setting_value as unknown as { enabled: boolean };
        setEnabled(value.enabled ?? false);
      }
    } catch (error) {
      console.error("Error fetching animation feature setting:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    try {
      const newValue: Json = { enabled: checked };
      const { error } = await supabase
        .from("site_settings")
        .update({
          setting_value: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq("setting_key", "animation_feature");

      if (error) throw error;

      setEnabled(checked);
      toast({
        title: checked ? "Animation feature enabled" : "Animation feature disabled",
        description: checked
          ? "All users can now see the Animate button on their projects."
          : "Only admins can see the Animate button.",
      });
    } catch (error) {
      console.error("Error updating animation feature:", error);
      toast({
        title: "Error",
        description: "Failed to update animation feature setting.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <Film className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <CardTitle>Animation Feature</CardTitle>
            <CardDescription>
              Control whether users can access the 2D animation editor
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
          <div className="space-y-0.5">
            <Label htmlFor="animation-toggle" className="text-base font-medium">
              Show to all users
            </Label>
            <p className="text-sm text-muted-foreground">
              {enabled
                ? "All users can see the Animate button on project cards"
                : "Only admins can access the animation editor"}
            </p>
          </div>
          <Switch
            id="animation-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        </div>

        <div
          className={`flex items-center gap-2 p-3 rounded-lg ${
            enabled
              ? "bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800"
              : "bg-muted/50 border border-border"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              enabled ? "bg-violet-500" : "bg-muted-foreground/40"
            }`}
          />
          <span
            className={`text-sm font-medium ${
              enabled
                ? "text-violet-700 dark:text-violet-300"
                : "text-muted-foreground"
            }`}
          >
            {enabled ? "Visible to all users" : "Admin only"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
