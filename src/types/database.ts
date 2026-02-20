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
  sortBy?: 'name' | 'searches' | 'last_scrape';
  sortOrder?: 'asc' | 'desc';
}

// Categories response from API
export interface CategoriesResponse {
  mainCategories: string[];
  subCategories: Record<string, string[]>;
}

// Database types for Supabase client
export type Database = {
  public: {
    Tables: {
      ideas: {
        Row: Idea;
        Insert: Omit<Idea, 'created_at'> & { created_at?: string };
        Update: Partial<Idea>;
      };
      idea_history: {
        Row: IdeaHistory;
        Insert: Omit<IdeaHistory, 'id'> & { id?: number };
        Update: Partial<IdeaHistory>;
      };
      pins: {
        Row: Pin;
        Insert: Omit<Pin, 'created_at' | 'last_scrape'> & { created_at?: string; last_scrape?: string };
        Update: Partial<Pin>;
      };
      idea_pins: {
        Row: IdeaPin;
        Insert: Omit<IdeaPin, 'added_at'> & { added_at?: string };
        Update: Partial<IdeaPin>;
      };
    };
  };
};
