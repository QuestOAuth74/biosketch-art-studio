import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, Upload, Trash2, Search, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TEMPLATES, Template } from "@/lib/templates";

interface DBTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail: string | null;
  canvas_data: any;
  dimensions: { width: number; height: number };
  paper_size: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const TemplateManager = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<DBTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [editingTemplate, setEditingTemplate] = useState<DBTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tableExists, setTableExists] = useState(true);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("built_in_templates")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.code === 'PGRST204') {
          setTableExists(false);
          setTemplates([]);
        } else {
          console.error("Error fetching templates:", error);
          toast.error("Failed to load templates");
        }
      } else {
        setTableExists(true);
        setTemplates(data || []);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Sync hardcoded templates to database
  const syncFromHardcoded = async () => {
    setIsSyncing(true);
    try {
      let added = 0;
      let skipped = 0;

      for (let i = 0; i < TEMPLATES.length; i++) {
        const t = TEMPLATES[i];
        const { data: existing } = await supabase
          .from("built_in_templates")
          .select("id")
          .eq("id", t.id)
          .maybeSingle();

        if (existing) { skipped++; continue; }

        const { error } = await supabase.from("built_in_templates").insert({
          id: t.id, name: t.name, description: t.description, category: t.category,
          thumbnail: t.thumbnail, canvas_data: t.canvasData, dimensions: t.dimensions,
          paper_size: t.paperSize, sort_order: i, is_active: true,
        });

        if (error) console.error(`Failed to sync ${t.id}:`, error);
        else added++;
      }

      toast.success(`Synced: ${added} added, ${skipped} already exist`);
      fetchTemplates();
    } catch (error) {
      console.error("Error syncing:", error);
      toast.error("Failed to sync templates");
    } finally {
      setIsSyncing(false);
    }
  };

  // Save template metadata changes
  const handleSave = async () => {
    if (!editingTemplate) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("built_in_templates")
        .update({
          name: editingTemplate.name,
          description: editingTemplate.description,
          category: editingTemplate.category,
          canvas_data: editingTemplate.canvas_data,
          dimensions: editingTemplate.dimensions,
          paper_size: editingTemplate.paper_size,
          is_active: editingTemplate.is_active,
          sort_order: editingTemplate.sort_order,
        })
        .eq("id", editingTemplate.id);

      if (error) throw error;
      toast.success("Template saved");
      fetchTemplates();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  // Open template in the main canvas for visual editing
  const handleOpenInCanvas = () => {
    if (!editingTemplate) return;
    // Store template in sessionStorage so the canvas page can pick it up
    const templateForCanvas: Template = {
      id: editingTemplate.id,
      name: editingTemplate.name,
      description: editingTemplate.description,
      category: editingTemplate.category as Template['category'],
      thumbnail: editingTemplate.thumbnail || '',
      canvasData: editingTemplate.canvas_data,
      dimensions: editingTemplate.dimensions,
      paperSize: editingTemplate.paper_size,
    };
    sessionStorage.setItem('admin_edit_template', JSON.stringify(templateForCanvas));
    sessionStorage.setItem('admin_edit_template_id', editingTemplate.id);
    navigate('/canvas');
    toast.info('Template loaded into canvas. Edit it, save, then return to admin to update.');
  };

  // Capture canvas state from sessionStorage (set by canvas page on save)
  const handleSaveFromCanvas = async () => {
    if (!editingTemplate) return;
    const savedData = sessionStorage.getItem('admin_template_canvas_data');
    if (!savedData) {
      toast.error('No canvas data found. Open the template in canvas, make edits, and save the project first.');
      return;
    }
    setIsSaving(true);
    try {
      const canvasData = JSON.parse(savedData);
      const { error } = await supabase
        .from("built_in_templates")
        .update({ canvas_data: canvasData })
        .eq("id", editingTemplate.id);

      if (error) throw error;

      setEditingTemplate({ ...editingTemplate, canvas_data: canvasData });
      sessionStorage.removeItem('admin_template_canvas_data');
      sessionStorage.removeItem('admin_edit_template');
      sessionStorage.removeItem('admin_edit_template_id');
      toast.success("Canvas content saved to template");
      fetchTemplates();
    } catch (error) {
      console.error("Error saving from canvas:", error);
      toast.error("Failed to save canvas to template");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete template
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    try {
      const { error } = await supabase.from("built_in_templates").delete().eq("id", id);
      if (error) throw error;
      toast.success("Template deleted");
      if (editingTemplate?.id === id) setEditingTemplate(null);
      fetchTemplates();
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  // Filter
  const filtered = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || t.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(templates.map(t => t.category))];

  // ── EDITING VIEW ──
  if (editingTemplate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setEditingTemplate(null)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to list
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingTemplate(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-2">
              <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Properties"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left — Canvas actions */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="text-sm font-semibold">Visual Editor</h3>
                <p className="text-sm text-muted-foreground">
                  Edit this template using the full BioSketch canvas editor. Load it, make your changes, then save the canvas content back.
                </p>

                <div className="flex flex-col gap-3">
                  <Button onClick={handleOpenInCanvas} className="gap-2 w-full" variant="default">
                    <ExternalLink className="h-4 w-4" />
                    Open in Canvas Editor
                  </Button>
                  <Button onClick={handleSaveFromCanvas} variant="outline" className="gap-2 w-full" disabled={isSaving}>
                    <Download className="h-4 w-4" />
                    {isSaving ? "Saving..." : "Save from Canvas"}
                  </Button>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-[12px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    <strong>Workflow:</strong> Click "Open in Canvas Editor" to load the template.
                    Edit objects, text, colors — use the full toolbar. When done, scroll back here
                    and click "Save from Canvas" to capture your changes.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Thumbnail preview */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Current Thumbnail</h3>
                <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center border">
                  {editingTemplate.thumbnail ? (
                    <img src={editingTemplate.thumbnail} alt={editingTemplate.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No thumbnail</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  ID: <code className="bg-muted px-1 rounded">{editingTemplate.id}</code> |
                  Updated: {new Date(editingTemplate.updated_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right — Properties */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold">Properties</h3>

              <div className="space-y-2">
                <Label className="text-xs">Name</Label>
                <Input value={editingTemplate.name} onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })} className="h-9" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Description</Label>
                <Textarea value={editingTemplate.description} onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })} rows={2} className="resize-none" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Category</Label>
                <Select value={editingTemplate.category} onValueChange={(v) => setEditingTemplate({ ...editingTemplate, category: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scientific">Scientific</SelectItem>
                    <SelectItem value="flowchart">Flowchart</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Width (px)</Label>
                  <Input type="number" value={editingTemplate.dimensions?.width || 1200} onChange={(e) => setEditingTemplate({ ...editingTemplate, dimensions: { ...editingTemplate.dimensions, width: parseInt(e.target.value) || 1200 } })} className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Height (px)</Label>
                  <Input type="number" value={editingTemplate.dimensions?.height || 800} onChange={(e) => setEditingTemplate({ ...editingTemplate, dimensions: { ...editingTemplate.dimensions, height: parseInt(e.target.value) || 800 } })} className="h-9" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Paper Size</Label>
                <Select value={editingTemplate.paper_size} onValueChange={(v) => setEditingTemplate({ ...editingTemplate, paper_size: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="letter">Letter</SelectItem>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="widescreen">Widescreen (16:9)</SelectItem>
                    <SelectItem value="poster">Poster</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Sort Order</Label>
                <Input type="number" value={editingTemplate.sort_order} onChange={(e) => setEditingTemplate({ ...editingTemplate, sort_order: parseInt(e.target.value) || 0 })} className="h-9" />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label className="text-xs">Active (visible to users)</Label>
                <Switch checked={editingTemplate.is_active} onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, is_active: checked })} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search templates..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-9 pl-9 text-sm" />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map(c => (<SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={syncFromHardcoded} disabled={isSyncing} className="gap-2">
          <Upload className="h-4 w-4" /> {isSyncing ? "Syncing..." : "Sync from Code"}
        </Button>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{templates.length} total</span>
        <span>{templates.filter(t => t.is_active).length} active</span>
        <span>{filtered.length} shown</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : !tableExists ? (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">
              The <code className="bg-muted px-1.5 py-0.5 rounded text-sm">built_in_templates</code> table hasn't been created yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Run <code className="bg-muted px-1.5 py-0.5 rounded text-sm">supabase db push</code> to apply the migration, then click "Sync from Code".
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {templates.length === 0 ? 'No templates in database. Click "Sync from Code" to import.' : 'No templates match your search.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((template) => (
            <Card key={template.id} className={`group cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${!template.is_active ? 'opacity-50' : ''}`} onClick={() => setEditingTemplate(template)}>
              <CardContent className="p-0">
                <div className="aspect-video bg-muted rounded-t-lg overflow-hidden flex items-center justify-center">
                  {template.thumbnail ? (
                    <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No thumbnail</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate">{template.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{template.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{template.category}</Badge>
                    <div className="flex items-center gap-1">
                      {!template.is_active && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Hidden</Badge>}
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
