import * as THREE from "three";

import type { BallState } from "./physics";
import { flipperOutline } from "./table.config";
import { TUNING } from "./tuning";
import type { TableConfig } from "./types";

const COLORS = TUNING.visual.colors;

/** Render Three.js da mesa: constrói a cena a partir do TableConfig e sincroniza
 * com o estado da física a cada frame (bola interpolada). Fase 1–2 usa
 * geometria simples; a Fase 5 troca materiais por arte completa. */
export class SceneRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private table = new THREE.Group();
  private ballMesh: THREE.Mesh;
  private flipperMeshes: THREE.Object3D[] = [];
  private plungerMesh: THREE.Object3D;
  private dropTargetMeshes = new Map<string, THREE.Object3D>();
  private onResize = () => this.resize();

  constructor(
    canvas: HTMLCanvasElement,
    private config: TableConfig,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(COLORS.bg);

    const cam = TUNING.visual.camera;
    this.camera = new THREE.PerspectiveCamera(cam.fov, 1, 0.1, 300);
    this.camera.position.set(...cam.position);
    this.camera.lookAt(new THREE.Vector3(...cam.lookAt));

    this.table.rotation.x = THREE.MathUtils.degToRad(TUNING.visual.tableTiltDeg);
    this.scene.add(this.table);

    this.buildLights();
    this.buildPlayfield();
    this.buildWalls();
    this.ballMesh = this.buildBall();
    this.flipperMeshes = this.buildFlippers();
    this.plungerMesh = this.buildPlunger();
    this.buildBumpers();
    this.buildSlingshots();
    this.buildRollovers();
    this.buildDropTargets();
    this.buildRamps();

    this.resize();
    window.addEventListener("resize", this.onResize);
  }

  private buildLights(): void {
    this.scene.add(new THREE.HemisphereLight(0x9db4ff, 0x14141f, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(6, 24, 14);
    this.table.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
    fill.position.set(-8, 12, -6);
    this.table.add(fill);
  }

  private buildPlayfield(): void {
    const geo = new THREE.PlaneGeometry(this.config.width, this.config.height);
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.playfield,
      roughness: 0.85,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    this.table.add(mesh);
  }

  private buildWalls(): void {
    const t = this.config.wallThickness;
    const matOuter = new THREE.MeshStandardMaterial({
      color: COLORS.wall,
      roughness: 0.4,
      metalness: 0.6,
    });
    const matGuide = new THREE.MeshStandardMaterial({
      color: COLORS.guide,
      roughness: 0.6,
      metalness: 0.2,
    });
    for (const w of this.config.walls) {
      const dx = w.to.x - w.from.x;
      const dy = w.to.y - w.from.y;
      const len = Math.hypot(dx, dy);
      const midX = (w.from.x + w.to.x) / 2;
      const midY = (w.from.y + w.to.y) / 2;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(len + t * 2, 0.9, t),
        w.kind === "guide" ? matGuide : matOuter,
      );
      mesh.position.set(midX, 0.45, -midY);
      mesh.rotation.y = Math.atan2(dy, dx);
      this.table.add(mesh);
    }
  }

  private buildBall(): THREE.Mesh {
    const b = TUNING.physics.ball;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(b.radius, 32, 24),
      new THREE.MeshStandardMaterial({
        color: COLORS.ball,
        metalness: 0.9,
        roughness: 0.25,
      }),
    );
    this.table.add(mesh);
    return mesh;
  }

  private buildFlippers(): THREE.Object3D[] {
    return this.config.flippers.map((spec) => {
      const outline = flipperOutline(spec);
      const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, p.y)));
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.7,
        bevelEnabled: false,
      });
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: COLORS.flipper,
          roughness: 0.5,
          metalness: 0.2,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      const group = new THREE.Group();
      group.position.set(spec.pivot.x, 0.35, -spec.pivot.y);
      group.add(mesh);
      this.table.add(group);
      return group;
    });
  }

  private buildPlunger(): THREE.Object3D {
    const rod = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.6, 1.8),
      new THREE.MeshStandardMaterial({
        color: COLORS.plunger,
        metalness: 0.7,
        roughness: 0.3,
      }),
    );
    const lane = this.config.launchLane;
    const x = (lane.innerX + lane.outerX) / 2;
    rod.position.set(x, 0.3, -lane.bottomY + 0.9);
    this.table.add(rod);
    return rod;
  }

  private buildBumpers(): void {
    for (const bumper of this.config.bumpers) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(bumper.radius, bumper.radius * 0.92, 1.5, 24),
        new THREE.MeshStandardMaterial({
          color: 0x2a3350,
          roughness: 0.5,
          metalness: 0.4,
        }),
      );
      body.position.y = 0.75;
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(bumper.radius * 0.72, bumper.radius * 0.72, 0.5, 24),
        new THREE.MeshStandardMaterial({
          color: COLORS.plunger,
          emissive: COLORS.plunger,
          emissiveIntensity: 0.35,
          roughness: 0.35,
        }),
      );
      cap.position.y = 1.6;
      group.add(body, cap);
      group.position.set(bumper.pos.x, 0, -bumper.pos.y);
      this.table.add(group);
    }
  }

  private buildSlingshots(): void {
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.flipper,
      roughness: 0.55,
      metalness: 0.15,
    });
    for (const sling of this.config.slingshots) {
      const shape = new THREE.Shape(
        [sling.a, sling.c, sling.b].map((p) => new THREE.Vector2(p.x, p.y)),
      );
      const mesh = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false }),
        mat,
      );
      mesh.rotation.x = -Math.PI / 2;
      this.table.add(mesh);
    }
  }

  private buildRollovers(): void {
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.plunger,
      emissive: COLORS.plunger,
      emissiveIntensity: 0.5,
      roughness: 0.4,
    });
    for (const roll of this.config.rollovers) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(roll.radius, roll.radius, 0.08, 20),
        mat,
      );
      mesh.position.set(roll.pos.x, 0.06, -roll.pos.y);
      this.table.add(mesh);
    }
  }

  private buildDropTargets(): void {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf0b429,
      roughness: 0.4,
      metalness: 0.3,
    });
    for (const bank of this.config.dropTargetBanks) {
      for (const target of bank.targets) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(target.halfW * 2, 1.6, 0.3), mat);
        mesh.position.set(target.pos.x, 0.8, -target.pos.y);
        this.table.add(mesh);
        this.dropTargetMeshes.set(target.id, mesh);
      }
    }
  }

  private buildRamps(): void {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1c2c52,
      roughness: 0.35,
      metalness: 0.55,
      transparent: true,
      opacity: 0.85,
    });
    for (const ramp of this.config.ramps) {
      const pts = ramp.waypoints.map((p) => new THREE.Vector3(p.x, ramp.height, -p.y));
      const curve = new THREE.CatmullRomCurve3(pts);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.7, 10, false), mat);
      this.table.add(mesh);
    }
  }

  syncBall(ball: BallState, alpha: number): void {
    const r = TUNING.physics.ball.radius;
    const ix = ball.px + (ball.x - ball.px) * alpha;
    const iy = ball.py + (ball.y - ball.py) * alpha;
    this.ballMesh.visible = true;
    this.ballMesh.position.set(ix, r + ball.h, -iy);
  }

  hideBall(): void {
    this.ballMesh.visible = false;
  }

  syncFlippers(angles: number[]): void {
    for (let i = 0; i < this.flipperMeshes.length; i++) {
      const mesh = this.flipperMeshes[i];
      if (mesh) mesh.rotation.y = angles[i] ?? 0;
    }
  }

  syncPlunger(charge: number): void {
    const lane = this.config.launchLane;
    const x = (lane.innerX + lane.outerX) / 2;
    this.plungerMesh.position.z = -lane.bottomY + 0.9 + charge * 1.4;
  }

  syncDropTargets(downIds: string[]): void {
    for (const [id, mesh] of this.dropTargetMeshes) {
      mesh.visible = !downIds.includes(id);
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    window.removeEventListener("resize", this.onResize);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
