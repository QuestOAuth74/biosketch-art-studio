import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Wrench, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

interface MaintenanceSettings {
  enabled: boolean;
  message: string;
}

export const MaintenanceToggle = () => {
  const [settings, setSettings] = useState<MaintenanceSettings>({
    enabled: false,
    message: "We're performing scheduled maintenance. Some features may be temporarily unavailable."
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('setting_value')
        .eq('setting_key', 'maintenance_mode')
        .single();

      if (error) throw error;

      if (data?.setting_value) {
        const value = data.setting_value as unknown as MaintenanceSettings;
        setSettings({
          enabled: value.enabled ?? false,
          message: value.message ?? settings.message
        });
      }
    } catch (error) {
      console.error('Error fetching maintenance settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      const newValue: Json = { enabled, message: settings.message };
      const { error } = await supabase
        .from('site_settings')
        .update({
          setting_value: newValue,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'maintenance_mode');

      if (error) throw error;

      setSettings(prev => ({ ...prev, enabled }));
      toast({
        title: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
        description: enabled 
          ? 'Users will now see the maintenance banner on the homepage.' 
          : 'The maintenance banner is now hidden.'
      });
    } catch (error) {
      console.error('Error updating maintenance mode:', error);
      toast({
        title: 'Error',
        description: 'Failed to update maintenance mode.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMessage = async () => {
    setSaving(true);
    try {
      const newValue: Json = { enabled: settings.enabled, message: settings.message };
      const { error } = await supabase
        .from('site_settings')
        .update({
          setting_value: newValue,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'maintenance_mode');

      if (error) throw error;

      toast({
        title: 'Message saved',
        description: 'The maintenance message has been updated.'
      });
    } catch (error) {
      console.error('Error saving maintenance message:', error);
      toast({
        title: 'Error',
        description: 'Failed to save maintenance message.',
        variant: 'destructive'
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
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <CardTitle>Maintenance Mode</CardTitle>
            <CardDescription>
              Show a maintenance banner on the homepage to inform users
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle Switch */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
          <div className="space-y-0.5">
            <Label htmlFor="maintenance-toggle" className="text-base font-medium">
              Enable Maintenance Banner
            </Label>
            <p className="text-sm text-muted-foreground">
              {settings.enabled 
                ? 'Banner is currently visible on the homepage' 
                : 'Banner is hidden from users'}
            </p>
          </div>
          <Switch
            id="maintenance-toggle"
            checked={settings.enabled}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        </div>

        {/* Status Indicator */}
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          settings.enabled 
            ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' 
            : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            settings.enabled ? 'bg-amber-500 animate-pulse' : 'bg-green-500'
          }`} />
          <span className={`text-sm font-medium ${
            settings.enabled ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'
          }`}>
            {settings.enabled ? 'Maintenance mode is ACTIVE' : 'Site is operating normally'}
          </span>
        </div>

        {/* Message Editor */}
        <div className="space-y-3">
          <Label htmlFor="maintenance-message">Maintenance Message</Label>
          <Textarea
            id="maintenance-message"
            value={settings.message}
            onChange={(e) => setSettings(prev => ({ ...prev, message: e.target.value }))}
            placeholder="Enter the maintenance message..."
            rows={3}
            className="resize-none"
          />
          <Button 
            onClick={handleSaveMessage} 
            disabled={saving}
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Message
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
