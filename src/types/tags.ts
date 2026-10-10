export interface IconTag {
  tag: string;
  count: number;
}

export interface IconWithTags {
  id: string;
  name: string;
  category: string;
  tags: string[] | null;
  thumbnail: string | null;
}

export interface TagUpdateRequest {
  id: string;
  tags: string[];
}

export interface TagStatistics {
  totalIcons: number;
  taggedIcons: number;
  untaggedIcons: number;
  uniqueTags: number;
  avgTagsPerIcon: number;
  topTags: Array<{
    tag: string;
    count: number;
    percentage: number;
  }>;
}

export interface CSVImportPreview {
  status: 'valid' | 'error' | 'no-change';
  iconId: string;
  iconName: string;
  thumbnail: string | null;
  currentTags: string[];
  newTags: string[];
  error?: string;
}

export interface IconTagExport {
  id: string;
  name: string;
  category: string;
  tag1: string;
  tag2: string;
  tag3: string;
  current_tags: string;
}
