export interface IconSubmission {
  id: string;
  user_id: string;
  name: string;
  category: string;
  svg_content: string;
  thumbnail: string | null;
  description: string | null;
  usage_rights: 'free_to_share' | 'own_rights' | 'licensed' | 'public_domain';
  usage_rights_details: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

export interface IconSubmissionWithUser extends IconSubmission {
  submitter?: {
    email: string;
    full_name: string | null;
  };
}
