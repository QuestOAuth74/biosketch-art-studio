import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useMembraneSettings } from "@/hooks/useMembraneSettings";
import { useMembraneIcons } from "@/hooks/useMembraneIcons";
import { useState, useEffect } from "react";
import { WavesIcon } from "@phosphor-icons/react";
import { sanitizeSVG } from "@/lib/utils";

export const MembraneSettingsPanel = () => {
  const { settings, updateSettings, isUpdating } = useMembraneSettings();
  const { membraneIcons } = useMembraneIcons();

  const [iconSize, setIconSize] = useState(40);
  const [spacing, setSpacing] = useState(0);
  const [rotateToPath, setRotateToPath] = useState(true);
  const [doubleSided, setDoubleSided] = useState(false);
  const [orientationOffset, setOrientationOffset] = useState(0);

  useEffect(() => {
    if (settings) {
      setIconSize(settings.default_icon_size);
      setSpacing(settings.default_spacing);
      setRotateToPath(settings.default_rotate_to_path);
      setDoubleSided(settings.default_double_sided);
      setOrientationOffset(settings.default_orientation_offset);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings({
      default_icon_id: defaultIcon?.id || null,
      default_icon_size: iconSize,
      default_spacing: spacing,
      default_rotate_to_path: rotateToPath,
      default_double_sided: doubleSided,
      default_orientation_offset: orientationOffset,
    });
  };

  const defaultIcon = membraneIcons.find(icon => icon.is_default_membrane_icon);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <WavesIcon className="h-6 w-6 text-primary" />
          <div>
            <CardTitle>Membrane Tool Defaults</CardTitle>
            <CardDescription>
              Configure default settings for the membrane tool
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default Icon Display */}
        <div className="space-y-2">
          <Label>Default Membrane Icon</Label>
          {defaultIcon ? (
            <Card className="border-2 border-primary">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="aspect-square w-16 h-16 border border-border rounded-lg p-2 flex items-center justify-center bg-muted">
                    {defaultIcon.thumbnail ? (
                      defaultIcon.thumbnail.startsWith('data:image/png') ? (
                        <img
                          src={defaultIcon.thumbnail}
                          alt={defaultIcon.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div
                          dangerouslySetInnerHTML={{ __html: sanitizeSVG(defaultIcon.thumbnail) }}
                          className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
                        />
                      )
                    ) : (
                      <div className="text-xs text-muted-foreground">No preview</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{defaultIcon.name}</p>
                    <p className="text-xs text-muted-foreground">Current Default</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-4 text-center text-muted-foreground text-sm">
                No default icon set. Toggle the "Default" switch on a membrane icon in the Manage Icons section.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Icon Size */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Default Icon Size</Label>
            <span className="text-sm text-muted-foreground">{iconSize}px</span>
          </div>
          <Slider
            value={[iconSize]}
            onValueChange={(v) => setIconSize(v[0])}
            min={20}
            max={100}
            step={1}
          />
        </div>

        {/* Spacing */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Default Spacing</Label>
            <span className="text-sm text-muted-foreground">
              {spacing}px {spacing === 0 && "(touching)"}
            </span>
          </div>
          <Slider
            value={[spacing]}
            onValueChange={(v) => setSpacing(v[0])}
            min={0}
            max={50}
            step={1}
          />
        </div>

        {/* Orientation */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Default Orientation Offset</Label>
            <span className="text-sm text-muted-foreground">{orientationOffset}°</span>
          </div>
          <Slider
            value={[orientationOffset]}
            onValueChange={(v) => setOrientationOffset(v[0])}
            min={0}
            max={360}
            step={15}
          />
        </div>

        {/* Switches */}
        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <Label>Rotate to follow path (default)</Label>
            <Switch
              checked={rotateToPath}
              onCheckedChange={setRotateToPath}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Double-sided/bilayer (default)</Label>
            <Switch
              checked={doubleSided}
              onCheckedChange={setDoubleSided}
            />
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isUpdating}
          className="w-full"
        >
          {isUpdating ? 'Saving...' : 'Save Default Settings'}
        </Button>
      </CardContent>
    </Card>
  );
};
