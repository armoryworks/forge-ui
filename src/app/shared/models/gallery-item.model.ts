export interface GalleryItem {
  url: string;
  thumbnailUrl?: string;
  title?: string;
  type: 'image' | 'pdf' | 'other';
}
