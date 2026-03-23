export interface ArticleSection {
  type: 'text' | 'image' | 'callout';
  content?: string;
  url?: string;
  alt?: string;
  caption?: string;
  level?: 'info' | 'warning' | 'tip';
}

export interface ArticleContent {
  body: string;
  sections: ArticleSection[];
}
