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
      backgroundColor: "#FFFFFF"
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
      const text = new Text(`${i}`);
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
    const length = shape.radius * 2;
    const LANDER_LENGTH = length;
    assert(shape instanceof Ball);
    if (flame instanceof Graphics) {
      flame.clear();

      const flameLines: [number, number][][] = [
        [
          [-.25 * LANDER_LENGTH, .45 * LANDER_LENGTH],
          [0 * LANDER_LENGTH, (.45 + lander.throttle) * LANDER_LENGTH],
          [.25 * LANDER_LENGTH, .45 * LANDER_LENGTH],
        ]
      ];
      flame.lineStyle(1, "#000000")
      drawSegments(flame, flameLines);
      console.log("Updated lander throttle", flameLines, lander.throttle);
    }
  }

  private createLanderGraphics(lander: Lander) {    
    const shape = lander.collider.shape;
    assert(shape instanceof Ball);
    const container = new Container();

    const length = shape.radius * 2;
    const LANDER_LENGTH = length;

    const flame = new Graphics();
    flame.name = "flame";
    const flameLines: [number, number][][] = [
      [
        [-.25 * LANDER_LENGTH, .45 * LANDER_LENGTH],
        [0 * LANDER_LENGTH, (.45 + lander.throttle) * LANDER_LENGTH],
        [.25 * LANDER_LENGTH, .45 * LANDER_LENGTH],
      ]
    ];
    flame.lineStyle(1, "#000000");
    drawSegments(flame, flameLines);

    const shuttle = new Graphics();
    const landerSegments: [number, number][][] = [
      // cockpit
      [
        [-.37 * length, 0 * length],
        [-.43 * LANDER_LENGTH, -.12 * LANDER_LENGTH],
        [-.38 * LANDER_LENGTH, -.3],
        [-.3 * LANDER_LENGTH, -.4 * LANDER_LENGTH],
        [-.1 * LANDER_LENGTH, -.5 * LANDER_LENGTH],
        [.1 * LANDER_LENGTH, -.5 * LANDER_LENGTH],
        [.3 * LANDER_LENGTH, -.4 * LANDER_LENGTH],
        [.38 * LANDER_LENGTH, -.3],
        [.43 * LANDER_LENGTH, -.12 * LANDER_LENGTH],
        [.37 * LANDER_LENGTH, 0 * LANDER_LENGTH]
      ],
      
      // Middle section
      [
        [-.45 * LANDER_LENGTH, 0 * LANDER_LENGTH],
        [.45 * LANDER_LENGTH, 0 * LANDER_LENGTH],
        [.45 * LANDER_LENGTH, .2 * LANDER_LENGTH],
        [-.45 * LANDER_LENGTH, .2 * LANDER_LENGTH],
        [-.45 * LANDER_LENGTH, 0 * LANDER_LENGTH]
      ],

      // Booster
      [
        [-.2 * LANDER_LENGTH, .2 * LANDER_LENGTH],
        [-.3 * LANDER_LENGTH, .45 * LANDER_LENGTH],
        [.3 * LANDER_LENGTH, .45 * LANDER_LENGTH],
        [.2 * LANDER_LENGTH, .2 * LANDER_LENGTH],
        [-.2 * LANDER_LENGTH, .2 * LANDER_LENGTH],
      ],

      // Legs
      [ 
        [.35 * LANDER_LENGTH, .2 * LANDER_LENGTH],
        [.45 * LANDER_LENGTH, .5 * LANDER_LENGTH],
      ],
      [ 
        [-.35 * LANDER_LENGTH, .2 * LANDER_LENGTH],
        [-.45 * LANDER_LENGTH, .5 * LANDER_LENGTH],
      ],

      // Feet
      [
        [.5 * LANDER_LENGTH, .5 * LANDER_LENGTH],
        [.4 * LANDER_LENGTH, .5 * LANDER_LENGTH],
      ],
      [ 
        [-.5 * LANDER_LENGTH, .5 * LANDER_LENGTH],
        [-.4 * LANDER_LENGTH, .5 * LANDER_LENGTH],
      ]
    ];

    shuttle.lineStyle(1, "#000000");
    drawSegments(shuttle, landerSegments);

    const gfx = new Graphics();
    gfx.beginFill("0xf3d9b1");
    gfx.drawCircle(0.0, 0.0, shape.radius);
    gfx.endFill();
    container.addChild(gfx);

    const gfx2 = new Graphics();
    gfx2.lineStyle(2, "#000000");
    gfx2.moveTo(0, -0.5 * LANDER_LENGTH);
    gfx2.lineTo(0, 0);
    container.addChild(gfx2);

    container.addChild(flame);
    container.addChild(shuttle);

    this.viewport.addChild(container);
    return container;
  }

  private createGroundGraphics(ground: Ground) {
    const shape = ground.collider.shape;
    assert(shape instanceof Polyline);
    const vertices = Array.from(shape.vertices);
    console.log("VERTICES", vertices);
    const gfx = new Graphics();
    gfx.lineStyle(2, "#000000").moveTo(vertices[0], -vertices[1]);
    for (let i=2; i<vertices.length; i+= 2) {
      gfx.lineTo(vertices[i], -vertices[i+1]);
    }
    gfx.position.x = 0;
    gfx.position.y = 0;
    this.viewport.addChild(gfx);
    return gfx;
  }
}

function drawSegments(gfx: Graphics, segments: [number, number][][]) {
  for (const section of segments) {
    let first = true;
    for (const vertex of section) {
      if (first) {
        gfx.moveTo(vertex[0], vertex[1]);
        first = false;
      } else {
        gfx.lineTo(vertex[0], vertex[1]);
      }
    }
  }
}

export default CanvasRenderer;