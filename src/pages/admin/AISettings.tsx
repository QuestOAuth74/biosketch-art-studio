import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAIProviderSettings } from '@/hooks/useAIProviderSettings';
import { SEOHead } from '@/components/SEO/SEOHead';

export default function AISettings() {
  const navigate = useNavigate();
  const { settings, isLoading, updateSettings, isUpdating } = useAIProviderSettings();

  const [primaryProvider, setPrimaryProvider] = useState<'manus' | 'lovable'>('manus');
  const [fallbackEnabled, setFallbackEnabled] = useState(true);
  const [timeoutMs, setTimeoutMs] = useState(45000);
  const [generationMode, setGenerationMode] = useState<'full' | 'structure'>('full');

  useEffect(() => {
    if (settings) {
      setPrimaryProvider(settings.primary_provider);
      setFallbackEnabled(settings.fallback_enabled);
      setTimeoutMs(settings.timeout_ms);
      setGenerationMode(settings.generation_mode || 'full');
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings({
      primary_provider: primaryProvider,
      fallback_enabled: fallbackEnabled,
      timeout_ms: timeoutMs,
      generation_mode: generationMode,
    });
  };

  const hasChanges = settings && (
    settings.primary_provider !== primaryProvider ||
    settings.fallback_enabled !== fallbackEnabled ||
    settings.timeout_ms !== timeoutMs ||
    (settings.generation_mode || 'full') !== generationMode
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="AI Provider Settings - Admin"
        description="Configure AI provider preferences for PowerPoint generation"
        noindex
      />
      
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin')}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>

          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
                <Sparkles className="h-8 w-8 text-primary" />
                AI Provider Settings
              </h1>
              <p className="text-muted-foreground">
                Configure which AI provider to use for PowerPoint generation
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Primary AI Provider</CardTitle>
                <CardDescription>
                  Choose which AI service will be used first for generating PowerPoint slides
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup
                  value={primaryProvider}
                  onValueChange={(value) => setPrimaryProvider(value as 'manus' | 'lovable')}
                >
                  <div className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="manus" id="manus" />
                    <div className="flex-1">
                      <Label htmlFor="manus" className="cursor-pointer">
                        <div className="font-semibold">Manus AI</div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Advanced AI specialized in document analysis and presentation structure.
                          Better at understanding context and creating intelligent layouts.
                        </p>
                      </Label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="lovable" id="lovable" />
                    <div className="flex-1">
                      <Label htmlFor="lovable" className="cursor-pointer">
                        <div className="font-semibold">Lovable AI</div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Fast and reliable AI using Google Gemini. Included with your subscription
                          with no additional API costs.
                        </p>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label>Generation Mode</Label>
                    <RadioGroup
                      value={generationMode}
                      onValueChange={(value) => setGenerationMode(value as 'full' | 'structure')}
                    >
                      <div className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="full" id="mode-full" />
                        <div className="flex-1">
                          <Label htmlFor="mode-full" className="cursor-pointer">
                            <div className="font-semibold flex items-center gap-2">
                              Full Generation 
                              <Badge variant="secondary" className="text-xs">Recommended</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Manus AI creates the complete PowerPoint with professional diagrams, flowcharts, 
                              and visual elements. Best quality and most advanced features.
                            </p>
                          </Label>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3 space-y-0 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="structure" id="mode-structure" />
                        <div className="flex-1">
                          <Label htmlFor="mode-structure" className="cursor-pointer">
                            <div className="font-semibold">Structure Generation</div>
                            <p className="text-sm text-muted-foreground mt-1">
                              AI generates slide structure (JSON), then we render with custom templates. 
                              Faster but limited diagram capabilities.
                            </p>
                          </Label>
                        </div>
                      </div>
                    </RadioGroup>
                    {generationMode === 'full' && primaryProvider !== 'manus' && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Full generation mode requires Manus AI as the primary provider.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="fallback">Enable Fallback Provider</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically switch to the other provider if the primary one fails
                      </p>
                    </div>
                    <Switch
                      id="fallback"
                      checked={fallbackEnabled}
                      onCheckedChange={setFallbackEnabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeout">Request Timeout (milliseconds)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      min="10000"
                      max="180000"
                      step="1000"
                      value={timeoutMs}
                      onChange={(e) => setTimeoutMs(parseInt(e.target.value))}
                      className="max-w-xs"
                    />
                    <p className="text-sm text-muted-foreground">
                      How long to wait for AI response before timing out (10-180 seconds)
                    </p>
                  </div>
                </div>

                {primaryProvider === 'manus' && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Note:</strong> Manus AI requires a valid API key configured in your
                      Supabase Edge Function secrets. Make sure MANUS_API_KEY is set.
                    </AlertDescription>
                  </Alert>
                )}

                {generationMode === 'full' && primaryProvider === 'manus' && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Full Generation Mode Details</AlertTitle>
                    <AlertDescription>
                      Manus will receive the complete Word document as an attachment and generate
                      a PowerPoint with diagrams, flowcharts, and rich visual elements. This mode
                      uses more credits but produces superior results with professional diagrams.
                      <br /><br />
                      <strong>Estimated time:</strong> 2-5 minutes per presentation
                      <br />
                      <strong>Credit usage:</strong> ~150-300 credits (≈$1.50-$3.00)
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/admin')}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || isUpdating}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong>1. Primary Provider:</strong> When a PowerPoint generation is requested,
                  the system will first attempt to use your selected primary provider.
                </p>
                <p>
                  <strong>2. Fallback (if enabled):</strong> If the primary provider fails or times out,
                  the system automatically switches to the secondary provider to ensure generation succeeds.
                </p>
                <p>
                  <strong>3. Timeout Protection:</strong> Requests that exceed the timeout limit will be
                  cancelled and either retry with fallback or return an error.
                </p>
                <p>
                  <strong>4. Usage Tracking:</strong> All AI provider usage is tracked in the database
                  for analytics and cost monitoring.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
