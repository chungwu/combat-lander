import { Renderer, Container, Graphics, Text } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { LanderGameState } from "./game-state";
import { Lander } from "./objects/lander";
import { Ball, Cuboid, Polyline, ShapeType } from "@dimforge/rapier2d";
import assert from "assert";
import { Ground } from "./objects/ground";
import { GameObject } from "./objects/game-object";
import { WORLD_WIDTH } from "./constants";
import { Rocket } from "./rocket";
import { Sky } from "./objects/sky";

export class CanvasRenderer {
  handle2gfx: Map<number, Graphics | Container>;
  handle2Shadows: Map<number, [Container, Container]>;
  renderer: Renderer;
  scene: Container;
  viewport: Viewport;
  constructor() {
    this.handle2gfx = new Map();
    this.handle2Shadows = new Map();
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
    (globalThis as any).VIEWPORT = this.viewport;
    this.viewport.moveCorner(0, 0)

    this.scene.addChild(this.viewport);

    for (let i=0; i<1000; i+= 100) {
      const text = new Text(`${i}`, {
        fill: "#FFFFFF",
        fontSize: 12
      });
      text.x = 10; 
      text.y = i;
      this.scene.addChild(text);
    }

    (globalThis as any).__PIXI_STAGE__ = this.scene;
    (globalThis as any).__PIXI_RENDERER__ = this.renderer;
    (globalThis as any).RERENDER = () => this.renderer.render(this.scene);
  }

  get canvasElement() {
    return this.renderer.view as HTMLCanvasElement;
  }

  resize() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
    this.viewport.screenWidth = window.innerWidth;
    this.viewport.screenHeight = window.innerHeight;
  }

  render(state: LanderGameState, playerId: string | undefined) {
    this.updateViewport(state, playerId);
    const seenHandles = new Set<number>();

    const handleObject = (object: GameObject) => {
      seenHandles.add(object.handle);
      let gfx = this.handle2gfx.get(object.handle);
      let shadows = this.handle2Shadows.get(object.handle);
      if (!gfx) {
        gfx = this.createObjectGraphics(object);
        this.handle2gfx.set(object.handle, gfx);
      }
      if (!shadows) {
        const left = this.createObjectGraphics(object);
        const right = this.createObjectGraphics(object);
        shadows = [left, right];
        this.handle2Shadows.set(object.handle, shadows);
      }
      const [ left, right ] = shadows;
      this.updateObjectGraphics(object, gfx);
      this.updateObjectGraphics(object, left);
      this.updateObjectGraphics(object, right);
      
      const translation = object.collider.translation();
      const rotation = object.collider.rotation();

      gfx.position.x = translation.x;
      left.position.x = gfx.position.x - state.moon.worldWidth;
      right.position.x = gfx.position.x + state.moon.worldWidth;

      gfx.position.y = left.position.y = right.position.y = this.viewport.worldHeight - translation.y;
      gfx.rotation = left.rotation = right.rotation = -rotation;
    };
    
    handleObject(state.ground);
    handleObject(state.sky);
    for (const lander of state.landers) {
      handleObject(lander);
    }
    for (const rocket of state.rockets) {
      handleObject(rocket);
    }

    for (const [ handle, gfx ] of Array.from(this.handle2gfx.entries())) {
      if (!seenHandles.has(handle)) {
        this.viewport.removeChild(gfx);
        gfx.destroy();
        this.handle2gfx.delete(handle);

        const shadows = this.handle2Shadows.get(handle);
        if (shadows) {
          for (const shadow of shadows) {
            this.viewport.removeChild(shadow);
            shadow.destroy();
          }
          this.handle2Shadows.delete(handle);
        }
      }
    }

    this.renderer.render(this.scene);
  }

  private updateViewport(game: LanderGameState, playerId: string | undefined) {
    this.viewport.worldHeight = game.moon.worldHeight;

    const minZoom = this.viewport.screenWidth / this.viewport.worldWidth;
    const selfLander = playerId ? game.landers.find(l => l.id === playerId) : undefined;
    const selfGfx = selfLander ? this.handle2gfx.get(selfLander?.handle) : undefined;
    if (selfLander) {
      this.viewport.scaled = Math.max(1, minZoom);

      // selfLander is to the left of the viewport left edge, so it must have
      // been just transported / wrapped; transport the viewport as well
      if (selfLander.translation.x < this.viewport.left) {
        this.viewport.left -= game.moon.worldWidth;
      }

      // Similarly, selfLander is to the right of the viewport right edge,
      // so it was also transported; follow as well
      if (selfLander.translation.x > this.viewport.right) {
        this.viewport.right += game.moon.worldWidth;
      }

      const marginX = this.viewport.screenWidthInWorldPixels * 0.3;
      this.viewport.left = Math.min(this.viewport.left, selfLander.translation.x - marginX);
      this.viewport.right = Math.max(this.viewport.right, selfLander.translation.x + marginX);

      const marginY = this.viewport.screenHeightInWorldPixels * 0.3;
      this.viewport.top = Math.min(this.viewport.top, (this.viewport.worldHeight - selfLander.translation.y) - marginY);
      this.viewport.bottom = Math.max(this.viewport.bottom, (this.viewport.worldHeight - selfLander.translation.y) + marginY, 0);

    } else {
      this.viewport.scaled = minZoom;
      this.viewport.bottom = game.moon.worldHeight;
      this.viewport.left = 0;
    }
  }

  private createObjectGraphics(object: GameObject) {
    if (object instanceof Lander) {
      return this.createLanderGraphics(object);
    } else if (object instanceof Ground) {
      return this.createGroundGraphics(object);
    } else if (object instanceof Sky) {
      return this.createSkyGraphics(object);
    } else if (object instanceof Rocket) {
      return this.createRocketGraphics(object);
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
    shuttle.lineStyle(1, lander.color);
    drawSegments(shuttle, SHUTTLE_COCKPIT, LANDER_LENGTH);
    shuttle.lineStyle(1, lander.color);
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
    // we use -y as the vertex, as the ground will be drawn at
    // the bottom of the canvas, so any elevation will need to be
    // negative height to point up past the graphics origin
    gfx.lineStyle(2, "#FFFFFF").moveTo(vertices[0], -vertices[1]);
    for (let i=2; i<vertices.length; i+= 2) {
      gfx.lineTo(vertices[i], -vertices[i+1]);
    }
    this.viewport.addChild(gfx);
    return gfx;
  }

  private createSkyGraphics(sky: Sky) {
    const shape = sky.collider.shape;
    assert(shape instanceof Polyline);
    const vertices = Array.from(shape.vertices);
    const gfx = new Graphics();
    gfx.lineStyle(2, "#EC6142").moveTo(vertices[0], -vertices[1]);
    for (let i=2; i<vertices.length; i+= 2) {
      gfx.lineTo(vertices[i], -vertices[i+1]);
    }
    this.viewport.addChild(gfx);
    return gfx;
  }

  private createRocketGraphics(rocket: Rocket) {
    const shape = rocket.collider.shape;
    assert(shape instanceof Cuboid);
    const gfx = new Graphics();
    gfx.lineStyle(1, rocket.color);
    drawSegments(gfx, [[
      [-shape.halfExtents.x, -shape.halfExtents.y],
      [shape.halfExtents.x, -shape.halfExtents.y],
      [shape.halfExtents.x, shape.halfExtents.y],
      [-shape.halfExtents.x, shape.halfExtents.y],
      [-shape.halfExtents.x, -shape.halfExtents.y],
    ]])
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

const SHUTTLE_COCKPIT: [number, number][][] = [
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
]

const SHUTTLE_SEGMENTS: [number, number][][] = [
  
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