// Database types for Supabase

export interface Idea {
  id: string;
  name: string;
  url: string | null;
  searches: number;
  last_update: string | null;
  last_scrape: string;
  related_interests: RelatedInterest[];
  top_annotations: string | null;
  annotation_url_map: Record<string, string> | null;  // lowercased name → absolute URL
  seo_breadcrumbs: string[];
  klp_pivots: KlpPivot[];
  language: string | null;
  created_at: string;
}

export interface KlpPivot {
  name: string;
  url: string;
}

// Extended Idea with pins (for API responses)
export interface IdeaWithPins extends Idea {
  pins: Pin[];
}

export interface RelatedInterest {
  name: string;
  url: string;
  id?: string;
}

// Pin stored in separate table
export interface Pin {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  image_thumbnail_url: string | null;
  link: string | null;
  article_url: string | null;  // Link to article for rich pins
  repin_count: number;
  save_count: number;
  comment_count: number;
  annotations: string[];
  pin_created_at: string | null;  // When pin was created on Pinterest
  domain: string | null;  // Domain of the original pin source
  board_name: string | null;  // Board name where pin was pinned
  last_scrape: string;
  created_at: string;
}

// Relationship table between ideas and pins
export interface IdeaPin {
  idea_id: string;
  pin_id: string;
  position: number;
  added_at: string;
}

// Pin with position (for display purposes)
export interface PinWithPosition extends Pin {
  position: number;
}

export interface IdeaHistory {
  id: number;
  idea_id: string;
  name: string;
  searches: number;
  scrape_date: string;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Extended pin detail (for single-pin live scraping with all available Pinterest data)
export interface PinDetail {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  image_thumbnail_url: string | null;
  images: Record<string, { url: string; width: number; height: number }>;
  link: string;
  article_url: string | null;
  repin_count: number;
  save_count: number;
  comment_count: number;
  annotations: { name: string; url: string }[];
  pin_created_at: string | null;
  domain: string | null;
  board: {
    id: string | null;
    name: string | null;
    url: string | null;
    privacy: string | null;
  };
  pinner: {
    id: string | null;
    username: string | null;
    full_name: string | null;
    image_url: string | null;
  };
  is_video: boolean;
  is_promoted: boolean;
  tracking_params: string | null;
  rich_metadata: {
    type: string | null;
    title: string | null;
    description: string | null;
    url: string | null;
    site_name: string | null;
    favicon_url: string | null;
  } | null;
  scraped_at: string;
}

export interface PinDetailResult {
  success: boolean;
  pin?: PinDetail;
  error?: string;
}

export interface ScrapeResult {
  success: boolean;
  idea?: Idea;
  pins?: Pin[];
  error?: string;
  isNew?: boolean;
  isDuplicate?: boolean;
}

export interface FindInterestsResult {
  urls: string[];
  total: number;
  duplicates: string[];
}

// Filter types for interests page
export interface InterestFilters {
  search?: string;
  category?: string;
  mainCategory?: string;
  subCategory?: string;
  minWords?: number;
  maxWords?: number;
  minSearches?: number;
  maxSearches?: number;
  sortBy?: 'name' | 'searches' | 'last_scrape' | 'last_update' | 'search_diff' | 'history_count' | 'klp_count' | 'related_count';
  sortOrder?: 'asc' | 'desc';
  language?: string;
}

// Categories response from API
export interface CategoriesResponse {
  mainCategories: string[];
  subCategories: Record<string, string[]>;
}

// RPC function return types
export interface FilteredIdea extends Idea {
  total_count: number;
  history_count: number;
  prev_searches: number | null;
}

export interface PinWithIdeas extends Pin {
  idea_ids: string[] | null;
  idea_names: string[] | null;
  total_count: number;
}
