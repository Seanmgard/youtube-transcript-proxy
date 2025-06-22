declare module 'youtube-transcript-api' {
  export interface TranscriptSegment {
    start: string;
    dur: string;
    text: string;
  }

  export interface TranscriptTrack {
    language: string;
    transcript: TranscriptSegment[];
  }

  export interface TranscriptResult {
    id: string;
    title: string;
    tracks: TranscriptTrack[];
    isLive: boolean;
    languages: Array<{
      label: string;
      languageCode: string;
    }>;
    isLoginRequired: boolean;
    playabilityStatus: {
      status: string;
      reason?: string;
    };
  }

  export default class TranscriptClient {
    constructor();
    ready: Promise<void>;
    getTranscript(videoId: string): Promise<TranscriptResult>;
  }
} 