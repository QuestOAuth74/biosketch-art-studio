export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_generation_usage: {
        Row: {
          created_at: string | null
          generated_at: string
          generation_type: string | null
          id: string
          month_year: string
          prompt: string | null
          style: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          generated_at?: string
          generation_type?: string | null
          id?: string
          month_year: string
          prompt?: string | null
          style?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          generated_at?: string
          generation_type?: string | null
          id?: string
          month_year?: string
          prompt?: string | null
          style?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_icon_generations: {
        Row: {
          background_type: string
          created_at: string | null
          creativity_level: string
          description: string | null
          generated_image_url: string
          icon_name: string | null
          id: string
          is_saved_to_library: boolean | null
          is_submitted_for_review: boolean | null
          prompt: string
          reference_image_url: string
          style: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          background_type?: string
          created_at?: string | null
          creativity_level?: string
          description?: string | null
          generated_image_url: string
          icon_name?: string | null
          id?: string
          is_saved_to_library?: boolean | null
          is_submitted_for_review?: boolean | null
          prompt: string
          reference_image_url: string
          style: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          background_type?: string
          created_at?: string | null
          creativity_level?: string
          description?: string | null
          generated_image_url?: string
          icon_name?: string | null
          id?: string
          is_saved_to_library?: boolean | null
          is_submitted_for_review?: boolean | null
          prompt?: string
          reference_image_url?: string
          style?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_icon_generations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_settings: {
        Row: {
          created_at: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      blog_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          order_index: number
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          order_index?: number
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          order_index?: number
          slug?: string
        }
        Relationships: []
      }
      blog_post_categories: {
        Row: {
          category_id: string
          id: string
          post_id: string
        }
        Insert: {
          category_id: string
          id?: string
          post_id: string
        }
        Update: {
          category_id?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_categories_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_tags: {
        Row: {
          id: string
          post_id: string
          tag_id: string
        }
        Insert: {
          id?: string
          post_id: string
          tag_id: string
        }
        Update: {
          id?: string
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "blog_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string
          content: Json
          created_at: string
          excerpt: string | null
          featured_image_alt: string | null
          featured_image_url: string | null
          id: string
          og_image: string | null
          published_at: string | null
          reading_time: number | null
          scheduled_for: string | null
          search_vector: unknown
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          slug: string
          status: string
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id: string
          content: Json
          created_at?: string
          excerpt?: string | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          id?: string
          og_image?: string | null
          published_at?: string | null
          reading_time?: number | null
          scheduled_for?: string | null
          search_vector?: unknown
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string
          content?: Json
          created_at?: string
          excerpt?: string | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          id?: string
          og_image?: string | null
          published_at?: string | null
          reading_time?: number | null
          scheduled_for?: string | null
          search_vector?: unknown
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      canvas_projects: {
        Row: {
          approval_status: string | null
          canvas_data: Json
          canvas_height: number
          canvas_width: number
          citations: string | null
          cloned_count: number | null
          created_at: string | null
          custom_unit: string | null
          description: string | null
          field_of_study: string | null
          id: string
          is_brush: boolean | null
          is_public: boolean | null
          keywords: string[] | null
          like_count: number | null
          name: string
          original_project_id: string | null
          paper_size: string | null
          rejection_reason: string | null
          thumbnail_updated_at: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string | null
          user_id: string
          view_count: number | null
        }
        Insert: {
          approval_status?: string | null
          canvas_data: Json
          canvas_height: number
          canvas_width: number
          citations?: string | null
          cloned_count?: number | null
          created_at?: string | null
          custom_unit?: string | null
          description?: string | null
          field_of_study?: string | null
          id?: string
          is_brush?: boolean | null
          is_public?: boolean | null
          keywords?: string[] | null
          like_count?: number | null
          name?: string
          original_project_id?: string | null
          paper_size?: string | null
          rejection_reason?: string | null
          thumbnail_updated_at?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
          view_count?: number | null
        }
        Update: {
          approval_status?: string | null
          canvas_data?: Json
          canvas_height?: number
          canvas_width?: number
          citations?: string | null
          cloned_count?: number | null
          created_at?: string | null
          custom_unit?: string | null
          description?: string | null
          field_of_study?: string | null
          id?: string
          is_brush?: boolean | null
          is_public?: boolean | null
          keywords?: string[] | null
          like_count?: number | null
          name?: string
          original_project_id?: string | null
          paper_size?: string | null
          rejection_reason?: string | null
          thumbnail_updated_at?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "canvas_projects_original_project_id_fkey"
            columns: ["original_project_id"]
            isOneToOne: false
            referencedRelation: "canvas_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      community_downloads: {
        Row: {
          download_format: string
          downloaded_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          download_format: string
          downloaded_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          download_format?: string
          downloaded_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_downloads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "canvas_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      community_survey_responses: {
        Row: {
          id: string
          user_id: string | null
          q1_role: string | null
          q1_role_other: string | null
          q2_research_area: string | null
          q2_research_area_other: string | null
          q3_pay_for_tool: string | null
          q4_preferred_tool: string | null
          q4_preferred_tool_other: string | null
          q5_cost_affected_quality: string | null
          q6_biosketch_familiarity: string | null
          q7_limitations: Json | null
          q7_limitations_other: string | null
          q8_usage_contexts: Json | null
          q8_usage_contexts_other: string | null
          q8_publication_link: string | null
          q9_feature_ratings: Json | null
          q10_missing_icons: string | null
          q11_open_source_importance: string | null
          q12_willing_to_contribute: Json | null
          signed_letter: boolean | null
          supporter_name: string | null
          supporter_institution: string | null
          supporter_role: string | null
          supporter_country: string | null
          supporter_email: string | null
          supporter_comments: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          q1_role?: string | null
          q1_role_other?: string | null
          q2_research_area?: string | null
          q2_research_area_other?: string | null
          q3_pay_for_tool?: string | null
          q4_preferred_tool?: string | null
          q4_preferred_tool_other?: string | null
          q5_cost_affected_quality?: string | null
          q6_biosketch_familiarity?: string | null
          q7_limitations?: Json | null
          q7_limitations_other?: string | null
          q8_usage_contexts?: Json | null
          q8_usage_contexts_other?: string | null
          q8_publication_link?: string | null
          q9_feature_ratings?: Json | null
          q10_missing_icons?: string | null
          q11_open_source_importance?: string | null
          q12_willing_to_contribute?: Json | null
          signed_letter?: boolean | null
          supporter_name?: string | null
          supporter_institution?: string | null
          supporter_role?: string | null
          supporter_country?: string | null
          supporter_email?: string | null
          supporter_comments?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          q1_role?: string | null
          q1_role_other?: string | null
          q2_research_area?: string | null
          q2_research_area_other?: string | null
          q3_pay_for_tool?: string | null
          q4_preferred_tool?: string | null
          q4_preferred_tool_other?: string | null
          q5_cost_affected_quality?: string | null
          q6_biosketch_familiarity?: string | null
          q7_limitations?: Json | null
          q7_limitations_other?: string | null
          q8_usage_contexts?: Json | null
          q8_usage_contexts_other?: string | null
          q8_publication_link?: string | null
          q9_feature_ratings?: Json | null
          q10_missing_icons?: string | null
          q11_open_source_importance?: string | null
          q12_willing_to_contribute?: Json | null
          signed_letter?: boolean | null
          supporter_name?: string | null
          supporter_institution?: string | null
          supporter_role?: string | null
          supporter_country?: string | null
          supporter_email?: string | null
          supporter_comments?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_survey_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          admin_notes: string | null
          country: string
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_read: boolean | null
          message: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          country: string
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_read?: boolean | null
          message: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          country?: string
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_read?: boolean | null
          message?: string
          user_id?: string | null
        }
        Relationships: []
      }
      dev_io_log: {
        Row: {
          data_size_kb: number | null
          duration_ms: number | null
          error: string | null
          id: string
          operation_type: string
          query_details: Json | null
          source: string
          table_name: string | null
          timestamp: string
        }
        Insert: {
          data_size_kb?: number | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          operation_type: string
          query_details?: Json | null
          source: string
          table_name?: string | null
          timestamp?: string
        }
        Update: {
          data_size_kb?: number | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          operation_type?: string
          query_details?: Json | null
          source?: string
          table_name?: string | null
          timestamp?: string
        }
        Relationships: []
      }
      icon_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      icon_review_status: {
        Row: {
          icon_id: string
          id: string
          ignore_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          icon_id: string
          id?: string
          ignore_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          icon_id?: string
          id?: string
          ignore_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "icon_review_status_icon_id_fkey"
            columns: ["icon_id"]
            isOneToOne: true
            referencedRelation: "icons"
            referencedColumns: ["id"]
          },
        ]
      }
      icon_submissions: {
        Row: {
          admin_notes: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          category: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          rejection_reason: string | null
          svg_content: string
          thumbnail: string | null
          updated_at: string | null
          usage_rights: string
          usage_rights_details: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          rejection_reason?: string | null
          svg_content: string
          thumbnail?: string | null
          updated_at?: string | null
          usage_rights: string
          usage_rights_details?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          rejection_reason?: string | null
          svg_content?: string
          thumbnail?: string | null
          updated_at?: string | null
          usage_rights?: string
          usage_rights_details?: string | null
          user_id?: string
        }
        Relationships: []
      }
      icons: {
        Row: {
          canvas_data: Json | null
          category: string
          created_at: string | null
          id: string
          is_default_membrane_icon: boolean
          is_membrane_icon: boolean
          name: string
          search_vector: unknown
          svg_content: string
          tags: Json | null
          thumbnail: string | null
          uploaded_by: string | null
        }
        Insert: {
          canvas_data?: Json | null
          category: string
          created_at?: string | null
          id?: string
          is_default_membrane_icon?: boolean
          is_membrane_icon?: boolean
          name: string
          search_vector?: unknown
          svg_content: string
          tags?: Json | null
          thumbnail?: string | null
          uploaded_by?: string | null
        }
        Update: {
          canvas_data?: Json | null
          category?: string
          created_at?: string | null
          id?: string
          is_default_membrane_icon?: boolean
          is_membrane_icon?: boolean
          name?: string
          search_vector?: unknown
          svg_content?: string
          tags?: Json | null
          thumbnail?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempt_time: string
          created_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          attempt_time?: string
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          attempt_time?: string
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      metrics_inflation_log: {
        Row: {
          id: string
          inflated_at: string | null
          inflated_by: string | null
          percentage: number
          projects_affected: number
          tier_filter: string | null
          total_clones_after: number
          total_clones_before: number
          total_likes_after: number
          total_likes_before: number
          total_views_after: number
          total_views_before: number
          variation_mode: string
        }
        Insert: {
          id?: string
          inflated_at?: string | null
          inflated_by?: string | null
          percentage: number
          projects_affected: number
          tier_filter?: string | null
          total_clones_after: number
          total_clones_before: number
          total_likes_after: number
          total_likes_before: number
          total_views_after: number
          total_views_before: number
          variation_mode: string
        }
        Update: {
          id?: string
          inflated_at?: string | null
          inflated_by?: string | null
          percentage?: number
          projects_affected?: number
          tier_filter?: string | null
          total_clones_after?: number
          total_clones_before?: number
          total_likes_after?: number
          total_likes_before?: number
          total_views_after?: number
          total_views_before?: number
          variation_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "metrics_inflation_log_inflated_by_fkey"
            columns: ["inflated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      powerpoint_custom_templates: {
        Row: {
          colors: Json
          created_at: string | null
          created_by: string
          description: string | null
          enhanced_bullets: Json | null
          fonts: Json
          id: string
          image_layouts: Json | null
          is_default: boolean | null
          layouts: Json
          name: string
          quote_styles: Json | null
          shaded_boxes: Json | null
          updated_at: string | null
        }
        Insert: {
          colors: Json
          created_at?: string | null
          created_by: string
          description?: string | null
          enhanced_bullets?: Json | null
          fonts: Json
          id?: string
          image_layouts?: Json | null
          is_default?: boolean | null
          layouts: Json
          name: string
          quote_styles?: Json | null
          shaded_boxes?: Json | null
          updated_at?: string | null
        }
        Update: {
          colors?: Json
          created_at?: string | null
          created_by?: string
          description?: string | null
          enhanced_bullets?: Json | null
          fonts?: Json
          id?: string
          image_layouts?: Json | null
          is_default?: boolean | null
          layouts?: Json
          name?: string
          quote_styles?: Json | null
          shaded_boxes?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      powerpoint_generations: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          generated_filename: string
          id: string
          original_filename: string
          status: string | null
          storage_path: string
          template_name: string
          user_id: string
          word_doc_path: string | null
          current_step: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: string | null
          error_message?: string | null
          generated_filename: string
          id?: string
          original_filename: string
          status?: string | null
          storage_path: string
          template_name: string
          user_id: string
          word_doc_path?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: string | null
          error_message?: string | null
          generated_filename?: string
          id?: string
          original_filename?: string
          status?: string | null
          storage_path?: string
          template_name?: string
          user_id?: string
          word_doc_path?: string | null
        }
        Relationships: []
      }
      powerpoint_images: {
        Row: {
          created_at: string | null
          generation_id: string
          height: number | null
          id: string
          image_type: string | null
          original_filename: string | null
          position: string | null
          slide_index: number | null
          storage_path: string
          width: number | null
        }
        Insert: {
          created_at?: string | null
          generation_id: string
          height?: number | null
          id?: string
          image_type?: string | null
          original_filename?: string | null
          position?: string | null
          slide_index?: number | null
          storage_path: string
          width?: number | null
        }
        Update: {
          created_at?: string | null
          generation_id?: string
          height?: number | null
          id?: string
          image_type?: string | null
          original_filename?: string | null
          position?: string | null
          slide_index?: number | null
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "powerpoint_images_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "powerpoint_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string | null
          email: string | null
          field_of_study: string | null
          full_name: string | null
          id: string
          last_login_at: string | null
          quote: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          field_of_study?: string | null
          full_name?: string | null
          id: string
          last_login_at?: string | null
          quote?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          field_of_study?: string | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          quote?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_likes: {
        Row: {
          created_at: string | null
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_likes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "canvas_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_versions: {
        Row: {
          canvas_data: Json
          canvas_height: number
          canvas_width: number
          created_at: string | null
          id: string
          is_auto_save: boolean | null
          paper_size: string | null
          project_id: string
          restore_count: number | null
          thumbnail_url: string | null
          user_id: string
          version_name: string | null
          version_number: number
        }
        Insert: {
          canvas_data: Json
          canvas_height: number
          canvas_width: number
          created_at?: string | null
          id?: string
          is_auto_save?: boolean | null
          paper_size?: string | null
          project_id: string
          restore_count?: number | null
          thumbnail_url?: string | null
          user_id: string
          version_name?: string | null
          version_number: number
        }
        Update: {
          canvas_data?: Json
          canvas_height?: number
          canvas_width?: number
          created_at?: string | null
          id?: string
          is_auto_save?: boolean | null
          paper_size?: string | null
          project_id?: string
          restore_count?: number | null
          thumbnail_url?: string | null
          user_id?: string
          version_name?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "canvas_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          country: string
          created_at: string
          id: string
          is_approved: boolean | null
          message: string
          name: string
          rating: number | null
          scientific_discipline: string
          user_id: string | null
        }
        Insert: {
          country: string
          created_at?: string
          id?: string
          is_approved?: boolean | null
          message: string
          name: string
          rating?: number | null
          scientific_discipline: string
          user_id?: string | null
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          is_approved?: boolean | null
          message?: string
          name?: string
          rating?: number | null
          scientific_discipline?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tool_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          is_viewed: boolean
          page: string
          rating: string
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          is_viewed?: boolean
          page?: string
          rating: string
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          is_viewed?: boolean
          page?: string
          rating?: string
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_assets: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          file_name: string
          file_size: number
          file_type: string
          height: number | null
          id: string
          is_shared: boolean | null
          last_used_at: string | null
          mime_type: string
          original_name: string
          shared_at: string | null
          storage_path: string
          tags: string[] | null
          thumbnail_path: string | null
          updated_at: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          file_name: string
          file_size: number
          file_type: string
          height?: number | null
          id?: string
          is_shared?: boolean | null
          last_used_at?: string | null
          mime_type: string
          original_name: string
          shared_at?: string | null
          storage_path: string
          tags?: string[] | null
          thumbnail_path?: string | null
          updated_at?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          height?: number | null
          id?: string
          is_shared?: boolean | null
          last_used_at?: string | null
          mime_type?: string
          original_name?: string
          shared_at?: string | null
          storage_path?: string
          tags?: string[] | null
          thumbnail_path?: string | null
          updated_at?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          sender_name: string
          sent_via_email: boolean | null
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          sender_name?: string
          sent_via_email?: boolean | null
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          sender_name?: string
          sent_via_email?: boolean | null
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_style_presets: {
        Row: {
          created_at: string | null
          id: string
          last_used_at: string | null
          name: string
          properties: Json
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          properties: Json
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          properties?: Json
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string | null
          field_of_study: string | null
          full_name: string | null
          id: string | null
          quote: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_user_generate: { Args: { _user_id: string }; Returns: Json }
      check_project_ownership: {
        Args: { check_project_id: string; check_user_id: string }
        Returns: boolean
      }
      cleanup_old_login_attempts: { Args: never; Returns: undefined }
      clone_project: {
        Args: { new_project_name: string; source_project_id: string }
        Returns: string
      }
      extract_tiptap_text: { Args: { content: Json }; Returns: string }
      generate_blog_slug: { Args: { title_param: string }; Returns: string }
      get_admin_ai_usage: {
        Args: { _from_date: string; _to_date: string }
        Returns: {
          id: string
          user_id: string
          generated_at: string
          month_year: string
          prompt: string
          style: string
          generation_type: string
        }[]
      }
      get_admin_notification_counts: {
        Args: never
        Returns: {
          pending_icons: number
          pending_projects: number
          pending_testimonials: number
          unread_messages: number
          unviewed_feedback: number
        }[]
      }
      get_all_public_profiles: {
        Args: never
        Returns: {
          avatar_url: string
          bio: string
          country: string
          created_at: string
          field_of_study: string
          full_name: string
          id: string
          quote: string
          updated_at: string
        }[]
      }
      get_public_profile: {
        Args: { user_id_param: string }
        Returns: {
          avatar_url: string
          bio: string
          country: string
          created_at: string
          field_of_study: string
          full_name: string
          id: string
          quote: string
          updated_at: string
        }[]
      }
      get_related_blog_posts: {
        Args: { limit_param?: number; post_id_param: string }
        Returns: {
          excerpt: string
          featured_image_url: string
          id: string
          published_at: string
          reading_time: number
          relevance_score: number
          slug: string
          title: string
        }[]
      }
      get_user_analytics: {
        Args: { limit_count?: number; offset_count?: number }
        Returns: {
          avatar_url: string
          country: string
          created_at: string
          email: string
          field_of_study: string
          full_name: string
          id: string
          last_login_at: string
          project_count: number
          quote: string
          total_count: number
        }[]
      }
      get_user_download_quota: {
        Args: { check_user_id: string }
        Returns: {
          can_download: boolean
          downloads_used: number
          has_unlimited: boolean
          projects_until_unlimited: number
          remaining_downloads: number
          shared_projects: number
        }[]
      }
      get_user_generation_count: {
        Args: { _month_year: string; _user_id: string }
        Returns: number
      }
      get_user_premium_progress: {
        Args: { check_user_id: string }
        Returns: {
          approved_count: number
          has_access: boolean
          remaining: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_blog_post_view_count: {
        Args: { post_id_param: string }
        Returns: undefined
      }
      increment_project_view_count: {
        Args: { project_id_param: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_has_premium_access: {
        Args: { check_user_id: string }
        Returns: boolean
      }
      user_has_public_projects: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      user_is_project_collaborator: {
        Args: { check_project_id: string; check_user_id: string }
        Returns: boolean
      }
      user_owns_project: {
        Args: { check_project_id: string; check_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
