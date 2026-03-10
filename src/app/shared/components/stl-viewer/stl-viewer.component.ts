import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  input,
  signal,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-stl-viewer',
  standalone: true,
  imports: [],
  templateUrl: './stl-viewer.component.html',
  styleUrl: './stl-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StlViewerComponent implements AfterViewInit, OnDestroy {
  readonly url = input.required<string>();
  readonly height = input<string>('400px');

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private renderer: import('three').WebGLRenderer | null = null;
  private scene: import('three').Scene | null = null;
  private camera: import('three').PerspectiveCamera | null = null;
  private controls: import('three/addons/controls/OrbitControls.js').OrbitControls | null = null;
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposables: { dispose: () => void }[] = [];

  ngAfterViewInit(): void {
    this.initViewer();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private async initViewer(): Promise<void> {
    try {
      const [THREE, { STLLoader }, { OrbitControls }] = await Promise.all([
        import('three'),
        import('three/addons/loaders/STLLoader.js'),
        import('three/addons/controls/OrbitControls.js'),
      ]);

      const containerEl = this.container().nativeElement;
      const canvasEl = this.canvas().nativeElement;
      const width = containerEl.clientWidth;
      const height = containerEl.clientHeight;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(this.getCssColor('--surface', '#f5f5f5'));
      this.scene = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
      this.camera = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({
        canvas: canvasEl,
        antialias: true,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer = renderer;

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.rotateSpeed = 0.8;
      this.controls = controls;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      scene.add(directionalLight);

      const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
      backLight.position.set(-1, -0.5, -1);
      scene.add(backLight);

      // Grid helper
      const gridHelper = new THREE.GridHelper(200, 40, 0xcccccc, 0xe0e0e0);
      scene.add(gridHelper);

      // Load STL
      const loader = new STLLoader();
      loader.load(
        this.url(),
        (geometry) => {
          geometry.computeVertexNormals();
          this.disposables.push(geometry);

          // Center the geometry
          geometry.computeBoundingBox();
          const boundingBox = geometry.boundingBox!;
          const center = new THREE.Vector3();
          boundingBox.getCenter(center);
          geometry.translate(-center.x, -center.y, -center.z);

          // Material
          const primaryColor = this.getCssColor('--primary', '#4a90d9');
          const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color(primaryColor),
            specular: 0x222222,
            shininess: 30,
            flatShading: false,
          });
          this.disposables.push(material);

          const mesh = new THREE.Mesh(geometry, material);
          scene.add(mesh);

          // Position camera to fit model
          const size = new THREE.Vector3();
          boundingBox.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const distance = maxDim * 2;
          camera.position.set(distance * 0.6, distance * 0.4, distance * 0.6);
          camera.lookAt(0, 0, 0);
          controls.target.set(0, 0, 0);
          controls.update();

          // Adjust grid to model size
          gridHelper.scale.setScalar(maxDim / 200);
          gridHelper.position.y = -size.y / 2;

          this.loading.set(false);
        },
        undefined,
        () => {
          this.loading.set(false);
          this.error.set('Failed to load 3D model');
        },
      );

      // Animation loop
      const animate = (): void => {
        this.animationFrameId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Resize handling
      this.resizeObserver = new ResizeObserver(() => {
        const w = containerEl.clientWidth;
        const h = containerEl.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
      this.resizeObserver.observe(containerEl);
    } catch {
      this.loading.set(false);
      this.error.set('Failed to initialize 3D viewer');
    }
  }

  private getCssColor(varName: string, fallback: string): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value || fallback;
  }

  private cleanup(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.resizeObserver?.disconnect();
    this.controls?.dispose();

    for (const disposable of this.disposables) {
      disposable.dispose();
    }

    this.renderer?.dispose();

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.animationFrameId = null;
    this.resizeObserver = null;
    this.disposables = [];
  }
}
