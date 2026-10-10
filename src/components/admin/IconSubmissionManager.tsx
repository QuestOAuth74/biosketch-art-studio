import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Eye, Clock, User } from 'lucide-react';
import { useIconSubmissions } from '@/hooks/useIconSubmissions';
import { IconSubmissionWithUser } from '@/types/iconSubmission';
import { useAuth } from '@/contexts/AuthContext';
import { sanitizeSVG } from '@/lib/utils';

export const IconSubmissionManager = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const { loading, submissions, fetchAllSubmissions, approveSubmission, rejectSubmission } = useIconSubmissions();
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedSubmission, setSelectedSubmission] = useState<IconSubmissionWithUser | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Only fetch submissions after auth is confirmed
    if (!authLoading && isAdmin) {
      fetchAllSubmissions();
    }
  }, [authLoading, isAdmin, fetchAllSubmissions]);

  const handleApprove = async (id: string) => {
    setProcessing(true);
    const success = await approveSubmission(id, adminNotes || undefined);
    if (success) {
      fetchAllSubmissions();
      setSelectedSubmission(null);
      setAdminNotes('');
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedSubmission || !rejectReason.trim()) return;
    
    setProcessing(true);
    const success = await rejectSubmission(selectedSubmission.id, rejectReason, adminNotes || undefined);
    if (success) {
      fetchAllSubmissions();
      setSelectedSubmission(null);
      setShowRejectDialog(false);
      setRejectReason('');
      setAdminNotes('');
    }
    setProcessing(false);
  };

  const filteredSubmissions = submissions.filter(s => s.approval_status === activeTab);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending Review</Badge>;
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return null;
    }
  };

  const usageRightsLabels = {
    free_to_share: 'Free to Share',
    own_rights: 'Owner Has Rights',
    licensed: 'Creative Commons',
    public_domain: 'Public Domain',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Icon Submissions</h2>
          <p className="text-muted-foreground">Review and manage community icon submissions</p>
        </div>
        <Button 
          onClick={() => fetchAllSubmissions()} 
          variant="outline"
          disabled={loading || authLoading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({submissions.filter(s => s.approval_status === 'pending').length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({submissions.filter(s => s.approval_status === 'approved').length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({submissions.filter(s => s.approval_status === 'rejected').length})
          </TabsTrigger>
        </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {(loading || authLoading) ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {authLoading ? 'Verifying admin access...' : 'Loading submissions...'}
                </p>
              </div>
            ) : filteredSubmissions.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No {activeTab} submissions</p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSubmissions.map((submission) => (
                <Card key={submission.id} className="p-6">
                  <div className="flex flex-col gap-4">
                    {/* Preview */}
                    <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
                      {submission.thumbnail ? (
                        <img src={submission.thumbnail} alt={submission.name} className="max-w-full max-h-full" />
                      ) : (
                        <div dangerouslySetInnerHTML={{ __html: sanitizeSVG(submission.svg_content) }} className="max-w-full max-h-full" />
                      )}
                    </div>

                    {/* Info */}
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold">{submission.name}</h3>
                        {getStatusBadge(submission.approval_status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Category: {submission.category}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <User className="h-3 w-3" />
                        {submission.submitter?.email || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(submission.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Usage Rights */}
                    <div className="bg-accent/50 rounded p-2">
                      <p className="text-xs font-medium">
                        Rights: {usageRightsLabels[submission.usage_rights]}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSubmission(submission)}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Details
                      </Button>
                      {submission.approval_status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(submission.id)}
                            disabled={processing}
                            className="flex-1"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedSubmission(submission);
                              setShowRejectDialog(true);
                            }}
                            disabled={processing}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Details Dialog */}
      <Dialog open={!!selectedSubmission && !showRejectDialog} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSubmission?.name}</DialogTitle>
            <DialogDescription>Icon submission details</DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-6">
              {/* Large Preview */}
              <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
                {selectedSubmission.thumbnail ? (
                  <img src={selectedSubmission.thumbnail} alt={selectedSubmission.name} className="max-w-full max-h-full" />
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: sanitizeSVG(selectedSubmission.svg_content) }} className="max-w-full max-h-full" />
                )}
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Category</p>
                  <p>{selectedSubmission.category}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  {getStatusBadge(selectedSubmission.approval_status)}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Submitter</p>
                  <p className="text-sm">{selectedSubmission.submitter?.email || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                  <p className="text-sm">{new Date(selectedSubmission.created_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Description */}
              {selectedSubmission.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                  <p className="text-sm">{selectedSubmission.description}</p>
                </div>
              )}

              {/* Usage Rights */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Usage Rights</p>
                <p className="text-sm mb-2">{usageRightsLabels[selectedSubmission.usage_rights]}</p>
                {selectedSubmission.usage_rights_details && (
                  <p className="text-sm text-muted-foreground">{selectedSubmission.usage_rights_details}</p>
                )}
              </div>

              {/* Admin Notes */}
              <div>
                <Label htmlFor="admin-notes">Admin Notes (Optional)</Label>
                <Textarea
                  id="admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Private notes for your records..."
                  rows={3}
                />
              </div>

              {/* Actions */}
              {selectedSubmission.approval_status === 'pending' && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedSubmission(null)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={processing}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleApprove(selectedSubmission.id)}
                    disabled={processing}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be visible to the submitter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="reject-reason">Rejection Reason *</Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this submission is being rejected..."
                rows={4}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || processing}
            >
              Reject Submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
