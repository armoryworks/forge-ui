export interface VideoChapter {
  timeSeconds: number;
  label: string;
}

export interface VideoContent {
  videoType: 'youtube' | 'vimeo' | 'minio';
  videoId: string;
  embedUrl: string;
  thumbnailUrl: string | null;
  chaptersJson: VideoChapter[];
  transcript: string | null;
}
