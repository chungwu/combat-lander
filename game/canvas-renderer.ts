import { Renderer, Container, Graphics, Text } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { LanderGameState } from "./game-state";
import { Lander } from "./objects/lander";
import { Ball, Polyline, ShapeType } from "@dimforge/rapier2d";
import assert from "assert";
import { Ground } from "./objects/ground";
import { GameObject } from "./objects/game-object";
import { WORLD_WIDTH } from "./constants";

export class CanvasRenderer {
  handle2gfx: Map<number, Graphics | Container>;
  renderer: Renderer;
  scene: Container;
  viewport: Viewport;
  constructor() {
    this.handle2gfx = new Map();
    this.renderer = new Renderer({
      antialias: true,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: "#000000"
    });
    this.scene = new Container();
    this.viewport = new Viewport({
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      worldWidth: WORLD_WIDTH,
      events: this.renderer.events
    });
    console.log("VIEWPORT", this.viewport);
    this.viewport.moveCorner(0, 0)

    this.scene.addChild(this.viewport);

    for (let i=0; i<1000; i+= 100) {
      const text = new Text(`${i}`, {
        fill: "#FFFFFF"
      });
      text.x = 10; 
      text.y = i;
      this.viewport.addChild(text);
    }

    (globalThis as any).__PIXI_STAGE__ = this.scene;
    (globalThis as any).__PIXI_RENDERER__ = this.renderer;
  }

  get canvasElement() {
    return this.renderer.view as HTMLCanvasElement;
  }

  resize() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  render(state: LanderGameState) {
    this.viewport.worldHeight = state.moon.worldHeight;
    this.viewport.bottom = 1000;

    const seenHandles = new Set<number>();

    const handleObject = (object: GameObject) => {
      seenHandles.add(object.handle);
      let gfx = this.handle2gfx.get(object.handle);
      if (!gfx) {
        gfx = this.createObjectGraphics(object);
        this.handle2gfx.set(object.handle, gfx);
      }
      const translation = object.collider.translation();
      const rotation = object.collider.rotation();
      gfx.position.x = translation.x;
      gfx.position.y = this.viewport.worldHeight - translation.y;
      gfx.rotation = -rotation;
      this.updateObjectGraphics(object, gfx);
    };
    
    handleObject(state.ground);
    for (const lander of state.landers) {
      handleObject(lander);
    }

    for (const [ handle, gfx ] of Array.from(this.handle2gfx.entries())) {
      if (!seenHandles.has(handle)) {
        this.viewport.removeChild(gfx);
        gfx.destroy();
        this.handle2gfx.delete(handle);
      }
    }

    this.renderer.render(this.scene);
  }

  private createObjectGraphics(object: GameObject) {
    if (object instanceof Lander) {
      return this.createLanderGraphics(object);
    } else if (object instanceof Ground) {
      return this.createGroundGraphics(object);
    } else {
      throw new Error(`Unknown game object ${object}`);
    }
  }

  private updateObjectGraphics(object: GameObject, gfx: Graphics | Container) {
    if (object instanceof Lander) {
      this.updateLanderGraphics(object, gfx);
    }
  }

  private updateLanderGraphics(lander: Lander, container: Container) {
    const flame = container.getChildByName("flame");  
    const shape = lander.collider.shape;
    assert(shape instanceof Ball);
    const LANDER_LENGTH = shape.radius * 2;
    assert(shape instanceof Ball);
    if (flame instanceof Graphics) {
      flame.clear();

      const flameLines: [number, number][][] = [
        [
          [-.25, .45],
          [0, (.45 + lander.throttle)],
          [.25, .45],
        ]
      ];
      flame.lineStyle(1, "#FFFFFF")
      drawSegments(flame, flameLines, LANDER_LENGTH);
    }
  }

  private createLanderGraphics(lander: Lander) {    
    const shape = lander.collider.shape;
    assert(shape instanceof Ball);
    const container = new Container();

    const length = shape.radius * 2;
    const LANDER_LENGTH = length;

    const shuttle = new Graphics();
    shuttle.lineStyle(1, "#FFFFFF");
    drawSegments(shuttle, SHUTTLE_SEGMENTS, LANDER_LENGTH);

    const flame = new Graphics();
    flame.name = "flame";

    container.addChild(flame);
    container.addChild(shuttle);

    this.viewport.addChild(container);
    return container;
  }

  private createGroundGraphics(ground: Ground) {
    const shape = ground.collider.shape;
    assert(shape instanceof Polyline);
    const vertices = Array.from(shape.vertices);
    const gfx = new Graphics();
    gfx.lineStyle(2, "#FFFFFF").moveTo(vertices[0], -vertices[1]);
    for (let i=2; i<vertices.length; i+= 2) {
      gfx.lineTo(vertices[i], -vertices[i+1]);
    }
    gfx.position.x = 0;
    gfx.position.y = 0;
    this.viewport.addChild(gfx);
    return gfx;
  }
}

function drawSegments(gfx: Graphics, segments: [number, number][][], scale: number = 1) {
  for (const section of segments) {
    let first = true;
    for (const vertex of section) {
      if (first) {
        gfx.moveTo(vertex[0] * scale, vertex[1] * scale);
        first = false;
      } else {
        gfx.lineTo(vertex[0] * scale, vertex[1] * scale);
      }
    }
  }
}

export default CanvasRenderer;

const SHUTTLE_SEGMENTS: [number, number][][] = [
  // cockpit
  [
    [-.37, 0],
    [-.43, -.12],
    [-.38, -.3],
    [-.3, -.4],
    [-.1, -.5],
    [.1, -.5],
    [.3, -.4],
    [.38, -.3],
    [.43, -.12],
    [.37, 0]
  ],
  
  // Middle section
  [
    [-.45, 0],
    [.45, 0],
    [.45, .2],
    [-.45, .2],
    [-.45, 0]
  ],

  // Booster
  [
    [-.2, .2],
    [-.3, .45],
    [.3, .45],
    [.2, .2],
    [-.2, .2],
  ],

  // Legs
  [ 
    [.35, .2],
    [.45, .5],
  ],
  [ 
    [-.35, .2],
    [-.45, .5],
  ],

  // Feet
  [
    [.5, .5],
    [.4, .5],
  ],
  [ 
    [-.5, .5],
    [-.4, .5],
  ]
];