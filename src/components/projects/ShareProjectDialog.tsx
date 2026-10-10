import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogScrollableContent, DialogTitle } from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, X, AlertCircle, Globe, Lock, Copy, Check, Paintbrush, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { generateProjectThumbnail } from '@/lib/thumbnailGenerator';
import { ShareDialogTestIds } from '@/lib/test-ids';
import { useAuth } from '@/contexts/AuthContext';
import { FIELDS_OF_STUDY } from '@/lib/constants';

interface ShareProjectDialogProps {
  project: {
    id: string;
    name: string;
    is_public?: boolean;
    title?: string | null;
    description?: string | null;
    keywords?: string[] | null;
    citations?: string | null;
    field_of_study?: string | null;
    approval_status?: string | null;
    is_brush?: boolean | null;
  };
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function ShareProjectDialog({ project, isOpen, onClose, onUpdate }: ShareProjectDialogProps) {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [saving, setSaving] = useState(false);
  const [generatingThumbnail, setGeneratingThumbnail] = useState(false);
  const [isPublic, setIsPublic] = useState(project.is_public || false);
  const [isBrush, setIsBrush] = useState(project.is_brush || false);
  const [title, setTitle] = useState(project.title || project.name);
  const [description, setDescription] = useState(project.description || '');
  const [citations, setCitations] = useState(project.citations || '');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>(project.keywords || []);
  const [fieldOfStudy, setFieldOfStudy] = useState(project.field_of_study || '');
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    setIsPublic(project.is_public || false);
    setIsBrush(project.is_brush || false);
    setTitle(project.title || project.name);
    setDescription(project.description || '');
    setCitations(project.citations || '');
    setKeywords(project.keywords || []);
    setFieldOfStudy(project.field_of_study || '');
  }, [project]);

  // Pre-fill field_of_study from user profile if not already set on the project
  useEffect(() => {
    if (fieldOfStudy || !isOpen) return;
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      const profileField = authUser?.user_metadata?.field_of_study;
      if (profileField && !fieldOfStudy) {
        setFieldOfStudy(profileField);
      }
    });
  }, [isOpen]);

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !keywords.includes(trimmed) && keywords.length < 10) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const handleCopyShareUrl = async () => {
    const shareUrl = `${window.location.origin}/shared/${project.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedUrl(true);
      toast.success('Share link copied to clipboard!');
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const generateThumbnail = async (): Promise<string | null> => {
    try {
      setGeneratingThumbnail(true);
      
      // Fetch the canvas data
      const { data: projectData, error: fetchError } = await supabase
        .from('canvas_projects')
        .select('canvas_data, canvas_width, canvas_height')
        .eq('id', project.id)
        .single();

      if (fetchError || !projectData) {
        console.error('Error fetching canvas data:', fetchError);
        return null;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      return await generateProjectThumbnail(
        projectData.canvas_data,
        projectData.canvas_width,
        projectData.canvas_height,
        project.id,
        user.id
      );
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    } finally {
      setGeneratingThumbnail(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (isPublic) {
      if (!title.trim()) {
        toast.error('Title is required for public projects');
        return;
      }
      if (title.trim().length > 100) {
        toast.error('Title must be 100 characters or less');
        return;
      }
      if (!description.trim()) {
        toast.error('Description is required for public projects');
        return;
      }
      if (description.trim().length < 10) {
        toast.error('Description must be at least 10 characters');
        return;
      }
      if (description.trim().length > 500) {
        toast.error('Description must be 500 characters or less');
        return;
      }
      if (keywords.length === 0) {
        toast.error('At least one keyword is required for public projects');
        return;
      }
      if (!fieldOfStudy) {
        toast.error('Field of study is required for public projects');
        return;
      }
    }

    setSaving(true);
    try {
      let thumbnailUrl = null;

      // Generate thumbnail if making project public
      if (isPublic) {
        thumbnailUrl = await generateThumbnail();
        if (!thumbnailUrl) {
          toast.error('Warning: Could not generate preview image, but project will still be saved', {
            duration: 5000,
          });
        }
      }

      const { error } = await supabase
        .from('canvas_projects')
        .update({
          is_public: isPublic,
          title: title.trim() || null,
          description: description.trim() || null,
          keywords: keywords.length > 0 ? keywords : null,
          citations: citations.trim() || null,
          field_of_study: fieldOfStudy || null,
          approval_status: isPublic ? 'pending' : null,
          is_brush: isPublic && isAdmin ? isBrush : false,
          thumbnail_url: thumbnailUrl,
          thumbnail_updated_at: thumbnailUrl ? new Date().toISOString() : null,
        })
        .eq('id', project.id);

      if (error) throw error;

      // Invalidate related queries to refresh counts and feature access
      queryClient.invalidateQueries({ queryKey: ['public-project-count'] });
      queryClient.invalidateQueries({ queryKey: ['feature-access'] });
      queryClient.invalidateQueries({ queryKey: ['pending-projects'] });
      queryClient.invalidateQueries({ queryKey: ['user-projects'] });

      toast.success(isPublic
        ? 'Project submitted for admin approval. It will appear in the community once approved.'
        : 'Project privacy updated');
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error updating project:', error);
      toast.error(error.message || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Publish to Community</DialogTitle>
          <DialogDescription>
            Submit your project for admin approval to appear in the community gallery
          </DialogDescription>
        </DialogHeader>

        <DialogScrollableContent className="space-y-6">
          {project.approval_status === 'pending' && project.is_public && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This project is pending admin approval.
              </AlertDescription>
            </Alert>
          )}
          {project.approval_status === 'approved' && project.is_public && (
            <Alert className="border-green-500">
              <AlertCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>
                This project has been approved and is visible in the community.
              </AlertDescription>
            </Alert>
          )}
          {project.approval_status === 'rejected' && (
            <Alert className="border-destructive">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <AlertDescription>
                <p className="font-medium mb-1">This project was not approved for the community gallery.</p>
                {(project as any).rejection_reason && (
                  <p className="text-sm mt-2 text-muted-foreground">
                    <strong>Reason:</strong> {(project as any).rejection_reason}
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Public Toggle - Enhanced */}
          <Card className="border-2 hover:border-primary/50 transition-colors cursor-pointer">
            <div className="p-4" onClick={() => setIsPublic(!isPublic)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isPublic ? (
                    <Globe className="h-5 w-5 text-primary" />
                  ) : (
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-semibold cursor-pointer">
                        Publish to Community
                      </Label>
                      <Badge variant={isPublic ? "default" : "secondary"}>
                        {isPublic ? "Public" : "Private"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isPublic 
                        ? "This project will be visible in the community gallery after approval"
                        : "Only you can see this project"
                      }
                    </p>
                  </div>
                </div>
                <Switch
                  id="public-toggle"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  onClick={(e) => e.stopPropagation()}
                  data-testid={ShareDialogTestIds.PUBLIC_TOGGLE}
                />
              </div>
            </div>
          </Card>

          {/* Reviewer policy notice — shown at the moment of submitting
              a project for community review, before the Save button.
              Gated on `isPublic && no existing approval_status` so it
              only appears for the first-time submission, not on
              already-pending / approved / rejected projects (those get
              their own status alert at the top of the dialog). */}
          {isPublic && !project.approval_status && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-900">
              <ShieldAlert className="h-4 w-4 text-amber-700" />
              <AlertDescription>
                <p className="font-bold mb-2 text-amber-900">
                  Before you submit — reviewer policy
                </p>
                <ul className="space-y-1.5 text-sm leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-700 shrink-0 mt-[3px]">•</span>
                    <span>
                      Reviewers only accept illustrations <strong>built in the BioSketch Canvas</strong> —
                      hand-drawn shapes, layered icons, arranged text, membrane and DNA tools, etc.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-700 shrink-0 mt-[3px]">•</span>
                    <span>
                      External icons are fine — as long as they are <strong>open-source</strong> and
                      free to redistribute.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-700 shrink-0 mt-[3px]">•</span>
                    <span>
                      <strong>AI-generated illustrations do NOT earn free AI credits</strong> — even
                      if approved. Credits are earned only by submissions built with the Canvas tools.
                    </span>
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Brush Toggle — admin only, shown when publishing */}
          {isAdmin && isPublic && (
            <Card className="border-2 hover:border-primary/50 transition-colors cursor-pointer">
              <div className="p-4" onClick={() => setIsBrush(!isBrush)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Paintbrush className={`h-5 w-5 ${isBrush ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <Label className="text-base font-semibold cursor-pointer">
                          Designate as Brush
                        </Label>
                        <Badge variant={isBrush ? "default" : "secondary"}>
                          {isBrush ? "Brush" : "Template"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {isBrush
                          ? "This project will appear in the Brushes category on the canvas"
                          : "This project will appear as a regular community template"
                        }
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="brush-toggle"
                    checked={isBrush}
                    onCheckedChange={setIsBrush}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </Card>
          )}

          {isPublic && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Making this project public allows anyone to view and clone it to their workspace.
                </AlertDescription>
              </Alert>

              <Alert className="border-orange-500 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-900">
                  <strong>Security Notice:</strong> Ensure your diagram doesn't contain sensitive or confidential information. 
                  All content (text, annotations, metadata) will be publicly visible after approval.
                </AlertDescription>
              </Alert>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter a descriptive title..."
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  {title.length}/100 characters
                </p>
              </div>

              {/* Field of Study */}
              <div className="space-y-2">
                <Label htmlFor="field-of-study">
                  Field of Study <span className="text-destructive">*</span>
                </Label>
                <Select value={fieldOfStudy} onValueChange={setFieldOfStudy}>
                  <SelectTrigger id="field-of-study">
                    <SelectValue placeholder="Select a field of study" />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELDS_OF_STUDY.map((field) => (
                      <SelectItem key={field} value={field}>
                        {field}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Categorize your project to help others find it
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this project is about..."
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {description.length}/500 characters (minimum 10)
                </p>
              </div>

              {/* Keywords */}
              <div className="space-y-2">
                <Label htmlFor="keywords">
                  Keywords <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="keywords"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addKeyword();
                      }
                    }}
                    placeholder="Add a keyword and press Enter..."
                    disabled={keywords.length >= 10}
                  />
                  <Button 
                    type="button" 
                    onClick={addKeyword}
                    disabled={keywords.length >= 10}
                  >
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {keywords.length}/10 keywords (at least 1 required)
                </p>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {keywords.map((keyword, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {keyword}
                        <button
                          type="button"
                          onClick={() => removeKeyword(keyword)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Citations */}
              <div className="space-y-2">
                <Label htmlFor="citations">
                  Citations <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="citations"
                  value={citations}
                  onChange={(e) => setCitations(e.target.value)}
                  placeholder="Add any relevant citations, references, or sources..."
                  rows={3}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">
                  {citations.length}/1000 characters
                </p>
              </div>

              {/* Share URL - Only show if project is approved */}
              {project.approval_status === 'approved' && (
                <Card className="border-2 border-primary/20 bg-primary/5">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-semibold">Share Link</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your project is approved! Share this link with anyone to view it.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`${window.location.origin}/shared/${project.id}`}
                        data-testid="share-project-url"
                        className="font-mono text-sm bg-background"
                        onClick={(e) => e.currentTarget.select()}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyShareUrl}
                        data-testid="copy-share-url-button"
                        className="gap-2 min-w-[100px]"
                      >
                        {copiedUrl ? (
                          <><Check className="h-4 w-4" />Copied!</>
                        ) : (
                          <><Copy className="h-4 w-4" />Copy</>
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </DialogScrollableContent>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || generatingThumbnail}>
            {saving || generatingThumbnail ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {generatingThumbnail ? 'Generating preview...' : 'Saving...'}
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
