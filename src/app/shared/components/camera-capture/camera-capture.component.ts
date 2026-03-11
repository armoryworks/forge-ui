import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { CameraCaptureResult } from '../../models/camera-capture-result.model';

type CameraState = 'initializing' | 'streaming' | 'captured' | 'denied' | 'unavailable';

@Component({
  selector: 'app-camera-capture',
  standalone: true,
  templateUrl: './camera-capture.component.html',
  styleUrl: './camera-capture.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraCaptureComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  private stream: MediaStream | null = null;

  readonly open = input<boolean>(false);
  readonly captured = output<CameraCaptureResult>();
  readonly closed = output<void>();

  protected readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  protected readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');
  protected readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInputEl');

  protected readonly state = signal<CameraState>('initializing');
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly capturedResult = signal<CameraCaptureResult | null>(null);

  constructor() {
    effect(() => {
      const isOpen = this.open();
      if (isOpen) {
        this.startCamera();
        this.addKeyboardListener();
      } else {
        this.cleanup();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  protected close(): void {
    this.cleanup();
    this.closed.emit();
  }

  protected capture(): void {
    const video = this.videoRef()?.nativeElement;
    const canvas = this.canvasRef()?.nativeElement;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const result: CameraCaptureResult = {
          blob,
          dataUrl,
          width: canvas.width,
          height: canvas.height,
        };

        this.capturedResult.set(result);
        this.previewUrl.set(dataUrl);
        this.state.set('captured');
        this.stopStream();
      },
      'image/jpeg',
      0.85,
    );
  }

  protected retake(): void {
    this.previewUrl.set(null);
    this.capturedResult.set(null);
    this.startCamera();
  }

  protected useCapture(): void {
    const result = this.capturedResult();
    if (result) {
      this.captured.emit(result);
      this.close();
    }
  }

  protected openFilePicker(): void {
    this.fileInputRef()?.nativeElement.click();
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    input.value = '';

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const result: CameraCaptureResult = {
          blob: file,
          dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
        };
        this.capturedResult.set(result);
        this.previewUrl.set(dataUrl);
        this.state.set('captured');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  private async startCamera(): Promise<void> {
    this.state.set('initializing');

    if (!navigator.mediaDevices?.getUserMedia) {
      this.state.set('unavailable');
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      // Wait a tick for the view to render before assigning srcObject
      requestAnimationFrame(() => {
        const video = this.videoRef()?.nativeElement;
        if (video && this.stream) {
          video.srcObject = this.stream;
          video.play().catch(() => {
            // play() rejection is non-critical (autoplay policy)
          });
          this.state.set('streaming');
        }
      });
    } catch (err) {
      const error = err as DOMException;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        this.state.set('denied');
      } else {
        this.state.set('unavailable');
      }
    }
  }

  private stopStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    const video = this.videoRef()?.nativeElement;
    if (video) {
      video.srcObject = null;
    }
  }

  private cleanup(): void {
    this.stopStream();
    this.previewUrl.set(null);
    this.capturedResult.set(null);
    this.state.set('initializing');
    this.removeKeyboardListener();
  }

  private readonly keydownHandler = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  };

  private addKeyboardListener(): void {
    this.document.addEventListener('keydown', this.keydownHandler);
  }

  private removeKeyboardListener(): void {
    this.document.removeEventListener('keydown', this.keydownHandler);
  }
}
