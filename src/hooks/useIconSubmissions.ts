import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { IconSubmission, IconSubmissionWithUser } from '@/types/iconSubmission';
import { generateCompressedThumbnail } from '@/utils/thumbnailGenerator';
import { minifySVG } from '@/lib/svgProcessor';

export const useIconSubmissions = () => {
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<IconSubmissionWithUser[]>([]);

  const fetchMySubmissions = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('icon_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('approval_status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSubmissions((data || []) as IconSubmissionWithUser[]);
      return (data || []) as IconSubmissionWithUser[];
    } catch (error: any) {
      console.error('Error fetching submissions:', error);
      toast.error('Failed to load submissions');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllSubmissions = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      
      let query = supabase
        .from('icon_submissions')
        .select(`
          *,
          submitter:profiles!icon_submissions_user_id_fkey(email, full_name)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('approval_status', status);
      }

      const { data, error } = await query;
      

      // If the join fails, fetch without submitter info as fallback
      if (error && error.message.includes('relationship')) {
        console.warn('[fetchAllSubmissions] Foreign key missing, fetching without submitter info');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('icon_submissions')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (fallbackError) throw fallbackError;
        
        const formatted = (fallbackData || []).map((item: any) => ({
          ...item,
          submitter: undefined
        }));
        
        setSubmissions(formatted);
        return formatted;
      }

      if (error) throw error;
      
      const formatted = (data || []).map((item: any) => ({
        ...item,
        submitter: item.submitter
      }));
      
      setSubmissions(formatted);
      return formatted;
    } catch (error: any) {
      console.error('[fetchAllSubmissions] Error:', error);
      toast.error('Failed to load submissions');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const submitIcon = useCallback(async (data: {
    name: string;
    category: string;
    svg_content: string;
    thumbnail: string;
    description?: string;
    usage_rights: IconSubmission['usage_rights'];
    usage_rights_details?: string;
  }) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast.error('You must be logged in to submit an icon');
        return null;
      }

      const { data: submission, error } = await supabase
        .from('icon_submissions')
        .insert({
          user_id: session.session.user.id,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Icon submitted successfully! It will be reviewed by our team.');
      return submission;
    } catch (error: any) {
      console.error('Error submitting icon:', error);
      toast.error(error.message || 'Failed to submit icon');
      return null;
    }
  }, []);

  const updateSubmission = useCallback(async (id: string, updates: Partial<IconSubmission>) => {
    try {
      const { error } = await supabase
        .from('icon_submissions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast.success('Submission updated successfully');
      return true;
    } catch (error: any) {
      console.error('Error updating submission:', error);
      toast.error('Failed to update submission');
      return false;
    }
  }, []);

  const deleteSubmission = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('icon_submissions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Submission deleted successfully');
      return true;
    } catch (error: any) {
      console.error('Error deleting submission:', error);
      toast.error('Failed to delete submission');
      return false;
    }
  }, []);

  const approveSubmission = useCallback(async (id: string, adminNotes?: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast.error('Unauthorized');
        return false;
      }

      // Get submission data
      const { data: submission, error: fetchError } = await supabase
        .from('icon_submissions')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Minify SVG to remove XML declarations, metadata, and reduce size
      const minifiedContent = minifySVG(submission.svg_content);

      // Generate compressed PNG thumbnail from svg_content (target: 5-20 KB)
      const compressedThumbnail = await generateCompressedThumbnail(minifiedContent, 128);

      // Insert into icons table
      const { error: insertError } = await supabase
        .from('icons')
        .insert({
          name: submission.name,
          category: submission.category,
          svg_content: minifiedContent,
          thumbnail: compressedThumbnail,
          uploaded_by: submission.user_id,
        });

      if (insertError) throw insertError;

      // Update submission status
      const { error: updateError } = await supabase
        .from('icon_submissions')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: session.session.user.id,
          admin_notes: adminNotes || null,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      toast.success('Icon approved and added to library!');
      return true;
    } catch (error: any) {
      console.error('Error approving submission:', error);
      toast.error('Failed to approve submission');
      return false;
    }
  }, []);

  const rejectSubmission = useCallback(async (id: string, reason: string, adminNotes?: string) => {
    try {
      const { error } = await supabase
        .from('icon_submissions')
        .update({
          approval_status: 'rejected',
          rejection_reason: reason,
          admin_notes: adminNotes || null,
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Submission rejected');
      return true;
    } catch (error: any) {
      console.error('Error rejecting submission:', error);
      toast.error('Failed to reject submission');
      return false;
    }
  }, []);

  return {
    loading,
    submissions,
    fetchMySubmissions,
    fetchAllSubmissions,
    submitIcon,
    updateSubmission,
    deleteSubmission,
    approveSubmission,
    rejectSubmission,
  };
};
