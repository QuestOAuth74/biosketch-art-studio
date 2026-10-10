import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trash2, Clock, CheckCircle, XCircle, Upload } from 'lucide-react';
import { useIconSubmissions } from '@/hooks/useIconSubmissions';
import { IconSubmissionDialog } from '@/components/community/IconSubmissionDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeSVG } from '@/lib/utils';

const submissionsStyles = `
  @keyframes sub-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .sub-fade-1 { animation: sub-fade-up 0.4s ease-out 0.1s both; }
  .sub-fade-2 { animation: sub-fade-up 0.4s ease-out 0.2s both; }
`;

const MySubmissions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loading, submissions, fetchMySubmissions, deleteSubmission } = useIconSubmissions();
  const [activeTab, setActiveTab] = useState('pending');
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchMySubmissions();

    supabase
      .from('icon_categories')
      .select('id, name')
      .order('name')
      .then(({ data }) => setCategories(data || []));
  }, [user]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const success = await deleteSubmission(deleteId);
    if (success) {
      fetchMySubmissions();
    }
    setDeleteId(null);
  };

  const filteredSubmissions = submissions.filter(s => s.approval_status === activeTab);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <style>{submissionsStyles}</style>

      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Header */}
        <div className="mb-10 sub-fade-1">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-1 h-8 bg-primary rounded-full" />
                  <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                    Share Your Work
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground tracking-tight mb-2">
                  My Icon Submissions
                </h1>
                <p className="text-lg text-muted-foreground">
                  Track the status of your submitted icons
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowSubmitDialog(true)}
              className="shadow-sm hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
            >
              <Upload className="h-4 w-4 mr-2" />
              Submit New Icon
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="sub-fade-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-10 rounded-xl bg-muted/60 p-1 border-2 border-dashed border-border/60">
              <TabsTrigger value="pending" className="text-sm rounded-lg data-[state=active]:shadow-sm transition-all duration-200">
                Pending ({submissions.filter(s => s.approval_status === 'pending').length})
              </TabsTrigger>
              <TabsTrigger value="approved" className="text-sm rounded-lg data-[state=active]:shadow-sm transition-all duration-200">
                Approved ({submissions.filter(s => s.approval_status === 'approved').length})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="text-sm rounded-lg data-[state=active]:shadow-sm transition-all duration-200">
                Rejected ({submissions.filter(s => s.approval_status === 'rejected').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {loading ? (
                <div className="rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-12 text-center">
                  <p className="text-muted-foreground">Loading submissions...</p>
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-12 text-center transition-all duration-300 hover:shadow-lg hover:border-border relative overflow-hidden group">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 opacity-0 group-hover:opacity-[0.015] transition-opacity duration-500 pointer-events-none"
                    style={{
                      backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)',
                      backgroundSize: '24px 24px',
                    }}
                  />
                  <div className="relative z-10">
                    <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-4">
                      No {activeTab} submissions yet
                    </p>
                    <Button
                      onClick={() => setShowSubmitDialog(true)}
                      className="shadow-sm hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Submit Your First Icon
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSubmissions.map((submission, index) => (
                    <div
                      key={submission.id}
                      className="group rounded-xl border-2 border-dashed border-border/60 hover:border-border bg-card/60 p-6 transition-all duration-300 hover:shadow-lg relative overflow-hidden animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 opacity-0 group-hover:opacity-[0.015] transition-opacity duration-500 pointer-events-none"
                        style={{
                          backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)',
                          backgroundSize: '24px 24px',
                        }}
                      />
                      <div className="relative z-10 flex flex-col gap-4">
                        {/* Preview */}
                        <div className="w-full h-32 bg-white rounded-lg border border-dashed border-border/40 flex items-center justify-center">
                          {submission.thumbnail ? (
                            <img src={submission.thumbnail} alt={submission.name} className="max-w-full max-h-full" />
                          ) : (
                            <div dangerouslySetInnerHTML={{ __html: sanitizeSVG(submission.svg_content) }} className="max-w-full max-h-full" />
                          )}
                        </div>

                        {/* Info */}
                        <div>
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-foreground">{submission.name}</h3>
                            {getStatusBadge(submission.approval_status)}
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            Category: {submission.category}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Submitted: {new Date(submission.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        {/* Description */}
                        {submission.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {submission.description}
                          </p>
                        )}

                        {/* Rejection Reason */}
                        {submission.rejection_reason && (
                          <div className="rounded-lg border-2 border-dashed border-destructive/30 bg-destructive/5 p-3">
                            <p className="text-sm font-medium text-destructive mb-1">Rejection Reason:</p>
                            <p className="text-sm text-muted-foreground">{submission.rejection_reason}</p>
                          </div>
                        )}

                        {/* Actions */}
                        {submission.approval_status === 'pending' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteId(submission.id)}
                            className="transition-all duration-200 active:scale-[0.98]"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Submit Dialog */}
      <IconSubmissionDialog
        open={showSubmitDialog}
        onOpenChange={setShowSubmitDialog}
        categories={categories}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this submission? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MySubmissions;
