import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, XCircle, Eye, ExternalLink, Pencil, Paintbrush, X, Plus } from 'lucide-react';
import { FIELDS_OF_STUDY } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ProjectThumbnail } from '@/components/projects/ProjectThumbnail';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';

interface Project {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  keywords: string[] | null;
  citations: string | null;
  approval_status: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  view_count: number;
  cloned_count: number;
  thumbnail_url: string | null;
  thumbnail_updated_at: string | null;
  user_id: string;
  canvas_width: number;
  canvas_height: number;
  is_brush: boolean | null;
  field_of_study: string | null;
}

export function SubmittedProjects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editKeywords, setEditKeywords] = useState<string[]>([]);
  const [editKeywordInput, setEditKeywordInput] = useState('');
  const [editCitations, setEditCitations] = useState('');
  const [editFieldOfStudy, setEditFieldOfStudy] = useState('');
  const [profileMap, setProfileMap] = useState<Map<string, { full_name: string | null; email: string | null }>>(new Map());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [totalProjects, setTotalProjects] = useState(0);

  const loadProjects = async () => {
    setLoading(true);
    try {
      // Get total count for pagination
      const { count, error: countError } = await supabase
        .from('canvas_projects')
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true)
        .eq('approval_status', activeTab);

      if (countError) throw countError;
      setTotalProjects(count || 0);

      // Calculate pagination range
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      // Fetch paginated data
      const { data, error } = await supabase
        .from('canvas_projects')
        .select('*')
        .eq('is_public', true)
        .eq('approval_status', activeTab)
        .order('updated_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setProjects(data || []);

      // Fetch submitter profiles
      const userIds = [...new Set((data || []).map((p: Project) => p.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        const map = new Map<string, { full_name: string | null; email: string | null }>();
        (profiles || []).forEach((p: any) => {
          map.set(p.id, { full_name: p.full_name, email: p.email });
        });
        setProfileMap(map);
      } else {
        setProfileMap(new Map());
      }
    } catch (error: any) {
      console.error('Error loading projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadProjects();
  }, [activeTab]);

  useEffect(() => {
    loadProjects();
  }, [currentPage]);

  const handleApprove = async (projectId: string) => {
    setActionLoading(true);
    try {
      // Verify current state before update
      const { data: before, error: beforeError } = await supabase
        .from('canvas_projects')
        .select('id, is_public, approval_status')
        .eq('id', projectId)
        .single();

      if (beforeError) throw beforeError;
      console.log('Before approval:', before);

      if (!before.is_public) {
        toast.error('Cannot approve: Project is not public');
        return;
      }

      const { error, data } = await supabase
        .from('canvas_projects')
        .update({ 
          approval_status: 'approved',
          rejection_reason: null 
        })
        .eq('id', projectId)
        .select();

      if (error) throw error;
      
      // Check if update actually succeeded
      if (!data || data.length === 0) {
        throw new Error('Update failed - no rows returned. You may not have permission to update this project.');
      }

      console.log('After approval:', data);

      // Invalidate queries to refresh counts for the project owner
      queryClient.invalidateQueries({ queryKey: ['public-project-count'] });
      queryClient.invalidateQueries({ queryKey: ['feature-access'] });
      queryClient.invalidateQueries({ queryKey: ['pending-projects'] });

      toast.success('Project approved and now visible in community');
      setCurrentPage(1);
      loadProjects();
    } catch (error: any) {
      console.error('Error approving project:', error);
      toast.error('Failed to approve project');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedProject || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('canvas_projects')
        .update({ 
          approval_status: 'rejected',
          rejection_reason: rejectionReason.trim()
        })
        .eq('id', selectedProject.id);

      if (error) throw error;

      // Invalidate queries to refresh counts for the project owner
      queryClient.invalidateQueries({ queryKey: ['public-project-count'] });
      queryClient.invalidateQueries({ queryKey: ['feature-access'] });
      queryClient.invalidateQueries({ queryKey: ['pending-projects'] });

      toast.success('Project rejected');
      setShowRejectDialog(false);
      setSelectedProject(null);
      setRejectionReason('');
      setCurrentPage(1);
      loadProjects();
    } catch (error: any) {
      console.error('Error rejecting project:', error);
      toast.error('Failed to reject project');
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectDialog = (project: Project) => {
    setSelectedProject(project);
    setRejectionReason('');
    setShowRejectDialog(true);
  };

  const handleToggleBrush = async (project: Project) => {
    const newValue = !project.is_brush;
    try {
      const { error } = await supabase
        .from('canvas_projects')
        .update({ is_brush: newValue })
        .eq('id', project.id);

      if (error) throw error;
      toast.success(newValue ? 'Marked as brush' : 'Removed brush designation');
      loadProjects();
    } catch (error: any) {
      console.error('Error toggling brush:', error);
      toast.error('Failed to update brush status');
    }
  };

  const handleFieldOfStudyChange = async (project: Project, value: string) => {
    try {
      const { error } = await supabase
        .from('canvas_projects')
        .update({ field_of_study: value })
        .eq('id', project.id);

      if (error) throw error;
      toast.success(`Field of study updated to ${value}`);
      loadProjects();
    } catch (error: any) {
      console.error('Error updating field of study:', error);
      toast.error('Failed to update field of study');
    }
  };

  const openEditDialog = (project: Project) => {
    setEditProject(project);
    setEditTitle(project.title || project.name || '');
    setEditDescription(project.description || '');
    setEditKeywords(project.keywords || []);
    setEditKeywordInput('');
    setEditCitations(project.citations || '');
    setEditFieldOfStudy(project.field_of_study || '');
    setShowEditDialog(true);
  };

  const handleAddKeyword = () => {
    const keyword = editKeywordInput.trim();
    if (keyword && editKeywords.length < 10 && !editKeywords.includes(keyword)) {
      setEditKeywords([...editKeywords, keyword]);
      setEditKeywordInput('');
    }
  };

  const handleRemoveKeyword = (index: number) => {
    setEditKeywords(editKeywords.filter((_, i) => i !== index));
  };

  const handleSaveEdit = async () => {
    if (!editProject) return;
    if (!editTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    if (editDescription.trim().length < 10) {
      toast.error('Description must be at least 10 characters');
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('canvas_projects')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim(),
          keywords: editKeywords,
          citations: editCitations.trim() || null,
          field_of_study: editFieldOfStudy || null,
        })
        .eq('id', editProject.id);

      if (error) throw error;

      toast.success('Project updated successfully');
      setShowEditDialog(false);
      setEditProject(null);
      loadProjects();
    } catch (error: any) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Submitted Projects</CardTitle>
          <CardDescription>
            Review and manage project submissions for the community gallery
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">Pending Review</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No {activeTab} projects found
                </div>
              ) : (
                <div className="space-y-4">
                  {projects.map((project) => (
                    <Card key={project.id} className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex gap-6">
                          {/* Thumbnail */}
                          <div className="flex-shrink-0 w-32 h-32">
                            <ProjectThumbnail
                              project={project}
                              alt={project.title || project.name}
                              className="w-full h-full object-cover rounded-lg border"
                            />
                          </div>

                          {/* Content */}
                          <div className="flex-1 space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-lg font-semibold">{project.title || project.name}</h3>
                                  {getStatusBadge(project.approval_status)}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Submitted {new Date(project.updated_at).toLocaleDateString()}
                                  {profileMap.get(project.user_id) && (
                                    <> by <span className="font-medium text-foreground">
                                      {profileMap.get(project.user_id)!.full_name || 'Unknown'}
                                    </span> ({profileMap.get(project.user_id)!.email || 'no email'})</>
                                  )}
                                </p>
                              </div>
                            </div>

                            {project.description && (
                              <p className="text-sm">{project.description}</p>
                            )}

                            {project.keywords && project.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {project.keywords.map((keyword, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {keyword}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {/* Field of Study */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Field:</span>
                              <Select
                                value={project.field_of_study || ''}
                                onValueChange={(value) => handleFieldOfStudyChange(project, value)}
                              >
                                <SelectTrigger className="h-8 w-48 text-xs">
                                  <SelectValue placeholder="Set field of study" />
                                </SelectTrigger>
                                <SelectContent>
                                  {FIELDS_OF_STUDY.map((field) => (
                                    <SelectItem key={field} value={field} className="text-xs">
                                      {field}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {project.citations && (
                              <div className="text-sm">
                                <span className="font-medium">Citations: </span>
                                <span className="text-muted-foreground">{project.citations}</span>
                              </div>
                            )}

                            {project.rejection_reason && activeTab === 'rejected' && (
                              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                                <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
                                <p className="text-sm text-muted-foreground mt-1">{project.rejection_reason}</p>
                              </div>
                            )}

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Eye className="h-4 w-4" />
                                {project.view_count} views
                              </span>
                              <span className="flex items-center gap-1">
                                <ExternalLink className="h-4 w-4" />
                                {project.cloned_count} clones
                              </span>
                            </div>

                            {/* Actions */}
                            {activeTab === 'pending' && (
                              <div className="flex gap-2 pt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditDialog(project)}
                                  disabled={actionLoading}
                                  className="gap-2"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/canvas/${project.id}`)}
                                  disabled={actionLoading}
                                  className="gap-2"
                                >
                                  <Eye className="h-4 w-4" />
                                  Open Canvas
                                </Button>
                                <Button
                                  size="sm"
                                  variant={project.is_brush ? "default" : "outline"}
                                  onClick={() => handleToggleBrush(project)}
                                  disabled={actionLoading}
                                  className="gap-2"
                                >
                                  <Paintbrush className="h-4 w-4" />
                                  {project.is_brush ? 'Brush' : 'Set as Brush'}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(project.id)}
                                  disabled={actionLoading}
                                  className="gap-2"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => openRejectDialog(project)}
                                  disabled={actionLoading}
                                  className="gap-2"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Reject
                                </Button>
                              </div>
                            )}

                            {activeTab === 'approved' && (
                              <div className="flex gap-2 pt-2">
                                <Button
                                  size="sm"
                                  variant={project.is_brush ? "default" : "outline"}
                                  onClick={() => handleToggleBrush(project)}
                                  disabled={actionLoading}
                                  className="gap-2"
                                >
                                  <Paintbrush className="h-4 w-4" />
                                  {project.is_brush ? 'Brush' : 'Set as Brush'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => openRejectDialog(project)}
                                  disabled={actionLoading}
                                  className="gap-2"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Revoke Approval
                                </Button>
                              </div>
                            )}

                            {activeTab === 'rejected' && (
                              <div className="flex gap-2 pt-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(project.id)}
                                  disabled={actionLoading}
                                  className="gap-2"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Approve
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Pagination */}
                  {!loading && projects.length > 0 && (
                    <div className="mt-6 space-y-4">
                      {/* Results summary */}
                      <div className="text-sm text-muted-foreground text-center">
                        Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalProjects)}-{Math.min(currentPage * itemsPerPage, totalProjects)} of {totalProjects} projects
                      </div>

                      {/* Pagination controls */}
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                          </PaginationItem>

                          {/* Page numbers */}
                          {Array.from({ length: Math.ceil(totalProjects / itemsPerPage) }, (_, i) => i + 1).map((page) => {
                            const totalPages = Math.ceil(totalProjects / itemsPerPage);
                            // Show first page, last page, current page, and pages around current
                            const showPage = 
                              page === 1 || 
                              page === totalPages || 
                              (page >= currentPage - 1 && page <= currentPage + 1);

                            if (!showPage) {
                              // Show ellipsis for gaps
                              if (page === currentPage - 2 || page === currentPage + 2) {
                                return (
                                  <PaginationItem key={page}>
                                    <PaginationEllipsis />
                                  </PaginationItem>
                                );
                              }
                              return null;
                            }

                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(page)}
                                  isActive={currentPage === page}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          })}

                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalProjects / itemsPerPage), p + 1))}
                              className={currentPage === Math.ceil(totalProjects / itemsPerPage) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Project</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this project. This will be visible to the project owner.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">
                Rejection Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this project cannot be approved..."
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {rejectionReason.length}/500 characters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading || !rejectionReason.trim()}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Reject Project'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project Before Approval</DialogTitle>
            <DialogDescription>
              Changes are saved directly to the original project submitted by the user.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Project title"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                {editTitle.length}/100 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Project description (min 10 characters)"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {editDescription.length}/500 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label>Keywords ({editKeywords.length}/10)</Label>
              <div className="flex gap-2">
                <Input
                  value={editKeywordInput}
                  onChange={(e) => setEditKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddKeyword();
                    }
                  }}
                  placeholder="Add a keyword..."
                  className="flex-1"
                  disabled={editKeywords.length >= 10}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddKeyword}
                  disabled={!editKeywordInput.trim() || editKeywords.length >= 10}
                  className="h-9 px-3"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {editKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {editKeywords.map((keyword, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 pr-1">
                      {keyword}
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(i)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-citations">Citations</Label>
              <Textarea
                id="edit-citations"
                value={editCitations}
                onChange={(e) => setEditCitations(e.target.value)}
                placeholder="Scholarly citations (optional)"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Field of Study</Label>
              <Select
                value={editFieldOfStudy}
                onValueChange={setEditFieldOfStudy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field of study" />
                </SelectTrigger>
                <SelectContent>
                  {FIELDS_OF_STUDY.map((field) => (
                    <SelectItem key={field} value={field}>
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={actionLoading || !editTitle.trim() || editDescription.trim().length < 10}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}