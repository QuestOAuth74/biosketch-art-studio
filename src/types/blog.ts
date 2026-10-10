export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: any; // TipTap JSON content
  excerpt?: string;
  featured_image_url?: string;
  featured_image_alt?: string;
  author_id: string;
  status: 'draft' | 'published' | 'scheduled';
  published_at?: string;
  scheduled_for?: string;
  view_count: number;
  reading_time?: number;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
  og_image?: string;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
    email?: string;
  };
  categories?: BlogCategory[];
  tags?: BlogTag[];
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  order_index: number;
  created_at: string;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface BlogPostCategory {
  id: string;
  post_id: string;
  category_id: string;
}

export interface BlogPostTag {
  id: string;
  post_id: string;
  tag_id: string;
}

export interface BlogPostsResult {
  posts: BlogPost[];
  count: number;
}
