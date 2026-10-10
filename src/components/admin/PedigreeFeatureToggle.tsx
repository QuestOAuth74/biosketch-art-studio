import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export const PedigreeFeatureToggle = () => {
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
        .eq("setting_key", "pedigree_feature")
        .maybeSingle();

      if (error) throw error;

      if (data?.setting_value) {
        const value = data.setting_value as unknown as { enabled: boolean };
        setEnabled(value.enabled ?? false);
      }
    } catch (error) {
      console.error("Error fetching pedigree setting:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    try {
      const newValue: Json = { enabled: checked };

      // Upsert — create if doesn't exist, update if it does
      const { error } = await supabase
        .from("site_settings")
        .upsert({
          setting_key: "pedigree_feature",
          setting_value: newValue,
          updated_at: new Date().toISOString(),
        }, { onConflict: "setting_key" });

      if (error) throw error;

      setEnabled(checked);
      toast.success(checked ? "Pedigree Chart Maker is now visible to users" : "Pedigree Chart Maker is now hidden from users");
    } catch (error) {
      console.error("Error updating pedigree setting:", error);
      toast.error("Failed to update setting");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Pedigree Chart Maker</Label>
            <p className="text-xs text-muted-foreground">
              When enabled, the free pedigree tool is accessible at /pedigree and visible in the footer.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        </div>

        <div className={`mt-4 p-3 rounded-lg text-sm ${enabled ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' : 'bg-muted/50 border border-border text-muted-foreground'}`}>
          {enabled ? 'Pedigree Chart Maker is live and accessible to all users.' : 'Pedigree Chart Maker is hidden from users.'}
        </div>
      </CardContent>
    </Card>
  );
};
