import { Renderer, Container, Graphics, Text, settings, DisplayObject } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { LanderGameState } from "./game-state";
import { Lander } from "./objects/lander";
import { Ball, Cuboid, Polyline, ShapeType } from "@dimforge/rapier2d";
import assert from "assert";
import { Ground } from "./objects/ground";
import { GameObject } from "./objects/game-object";
import { WORLD_WIDTH, getLanderColor } from "./constants";
import { Rocket } from "./rocket";
import { Sky } from "./objects/sky";
import { MONO } from "@/fonts";
import { Moon } from "./map";
import { tomatoDark } from "@radix-ui/colors";

type RenderedObjects = [Container, Container, Container];

export class CanvasRenderer {
  handle2gfx: Map<number, RenderedObjects>;
  handle2label: Map<number, DisplayObject | null>;
  renderer: Renderer;
  root: Container;
  viewport: Viewport;
  screenRoot: Container;
  curGameId: string | undefined;
  constructor() {
    this.handle2gfx = new Map();
    this.handle2label = new Map();
    this.renderer = new Renderer({
      antialias: true,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: "#000000",
      resolution: window.devicePixelRatio,
      autoDensity: true
    });
    this.root = new Container();
    this.viewport = new Viewport({
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      worldWidth: WORLD_WIDTH,
      events: this.renderer.events
    });
    (globalThis as any).VIEWPORT = this.viewport;
    this.viewport.moveCorner(0, 0)
    this.root.addChild(this.viewport);

    this.screenRoot = new Container();
    this.root.addChild(this.screenRoot);

    const legend = new Container();
    legend.name = "legend";
    this.screenRoot.addChild(legend);

    (globalThis as any).__PIXI_STAGE__ = this.root;
    (globalThis as any).__PIXI_RENDERER__ = this.renderer;
    (globalThis as any).RERENDER = () => this.renderer.render(this.root);
  }

  get canvasElement() {
    return this.renderer.view as HTMLCanvasElement;
  }

  private reset() {
    this.screenRoot.removeChildren();
    this.viewport.removeChildren();
    this.handle2gfx.clear();
    this.handle2label.clear();
  }

  private updateLegend() {
    let legend = this.screenRoot.getChildByName("legend");
    if (!legend) {
      legend = new Container();
      legend.name = "legend";
      this.screenRoot.addChild(legend);
    }
    assert(legend instanceof Container);
    legend.removeChildren();
    for (let i=0; i<1000; i+= 100) {
      const text = new Text(`${i}`, {
        fill: "#FFFFFF",
        fontSize: 12,
        fontFamily: MONO.style.fontFamily
      });
      text.x = 10; 
      text.y = this.viewport.toScreen(0, i).y;
      legend.addChild(text);
    }
  }

  resize() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
    this.viewport.screenWidth = window.innerWidth;
    this.viewport.screenHeight = window.innerHeight;
  }

  render(game: LanderGameState, playerId: string | undefined) {
    if (!this.curGameId || this.curGameId !== game.id) {
      // Game changed!  Clear everything
      this.reset();
      this.curGameId = game.id;
      this.viewport.worldWidth = game.moon.worldWidth;
    }

    this.updateViewport(game, playerId);
    const seenHandles = new Set<number>();

    const handleObject = (object: GameObject) => {
      seenHandles.add(object.handle);
      let gfxs = this.handle2gfx.get(object.handle);
      if (!gfxs) {
        const main = this.createObjectGraphics(object);
        const left = this.createObjectGraphics(object);
        const right = this.createObjectGraphics(object);
        gfxs = [main, left, right];
        this.handle2gfx.set(object.handle, gfxs);
      } else {
        const [main, left, right] = gfxs;
        this.updateObjectGraphics(object, main);
        this.updateObjectGraphics(object, left);
        this.updateObjectGraphics(object, right);
      }
      updateObjectGraphicsPositions(object, gfxs);
      
      if (!this.handle2label.has(object.handle)) {
        const label = this.createObjectLabel(object);
        if (label) {
          this.handle2label.set(object.handle, label);
        } else {
          this.handle2label.set(object.handle, null);
        }
      }
      const label = this.handle2label.get(object.handle);
      if (label) {
        this.updateObjectLabel(object, label);
        updateObjectLabelPositions(game, object, label);
      }
    };

    const updateObjectGraphicsPositions = (object: GameObject, gfxs: RenderedObjects) => {
      const [ main, left, right ] = gfxs;
      const rotation = object.collider.rotation();

      main.position.x = object.x;
      left.position.x = main.position.x - game.moon.worldWidth;
      right.position.x = main.position.x + game.moon.worldWidth;

      main.position.y = left.position.y = right.position.y = this.viewport.worldHeight - object.y;
      main.rotation = left.rotation = right.rotation = -rotation;
    };

    const updateObjectLabelPositions = (game: LanderGameState, object: GameObject, label: DisplayObject) => {
      const screenPos = this.viewport.toScreen(
        object.x, game.moon.worldHeight - object.y
      );
      label.position.x = screenPos.x;
      label.position.y = screenPos.y;
    };
    
    handleObject(game.ground);
    handleObject(game.sky);
    for (const lander of game.landers) {
      handleObject(lander);
    }
    for (const rocket of game.rockets) {
      handleObject(rocket);
    }

    for (const [ handle, gfxs ] of Array.from(this.handle2gfx.entries())) {
      if (!seenHandles.has(handle)) {
        this.destroyHandle(handle);
      }
    }

    this.updateLegend();

    this.renderer.render(this.root);
  }
  
  private destroyHandle(handle: number) {
    const gfxs = this.handle2gfx.get(handle);
    if (gfxs) {
      for (const gfx of gfxs) {
        gfx.destroy();
        this.viewport.removeChild(gfx);
      }
    }
    this.handle2gfx.delete(handle);
  }

  private updateViewport(game: LanderGameState, playerId: string | undefined) {
    this.viewport.worldHeight = game.moon.worldHeight;

    const minZoom = this.viewport.screenWidth / this.viewport.worldWidth;
    const selfLander = playerId ? game.landers.find(l => l.id === playerId) : undefined;
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

      const marginYTop = this.viewport.screenHeightInWorldPixels * 0.3;
      this.viewport.top = Math.min(this.viewport.top, (this.viewport.worldHeight - selfLander.translation.y) - marginYTop);
      
      const marginYBottom = this.viewport.screenHeightInWorldPixels * 0.5;
      this.viewport.bottom = Math.max(this.viewport.bottom, (this.viewport.worldHeight - selfLander.translation.y) + marginYBottom, 0);

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

  private createObjectLabel(object: GameObject) {
    if (object instanceof Lander) {
      return this.createLanderLabel(object);
    } else {
      return undefined;
    }
  }

  private updateObjectGraphics(object: GameObject, gfx: Graphics | Container) {
    if (object instanceof Lander) {
      this.updateLanderGraphics(object, gfx);
    }
  }

  private updateObjectLabel(object: GameObject, gfx: DisplayObject) {
    if (object instanceof Lander) {
      this.updateLanderLabel(object, gfx);
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

    if (!lander.isAlive()) {
      container.alpha = 0.5;
    }
  }

  private updateLanderLabel(lander: Lander, gfx: DisplayObject) {
    assert(gfx instanceof Container);
    const landerName = gfx.getChildByName("landerName");
    if (landerName instanceof Text) {
      if (landerName.text !== lander.name) {
        landerName.text = lander.name;
      }
    }
    const landerHealth = gfx.getChildByName("landerHealth");
    if (landerHealth instanceof Text) {
      if (landerHealth.text !== `${Math.ceil(lander.health)}`) {
        landerHealth.text = `${Math.ceil(lander.health)}`;
      }
    }

    if (!lander.isAlive()) {
      gfx.alpha = 0.5;
    }
  }

  private createLanderGraphics(lander: Lander) {    
    const shape = lander.collider.shape;
    assert(shape instanceof Ball);
    const container = new Container();

    const length = shape.radius * 2;
    const LANDER_LENGTH = length;

    const shuttle = new Graphics();
    shuttle.lineStyle(1, getLanderColor(lander.color, 9));
    drawSegments(shuttle, SHUTTLE_COCKPIT, LANDER_LENGTH);
    shuttle.lineStyle(1, getLanderColor(lander.color, 9));
    drawSegments(shuttle, SHUTTLE_SEGMENTS, LANDER_LENGTH);

    const flame = new Graphics();
    flame.name = "flame";

    container.addChild(flame);
    container.addChild(shuttle);

    this.viewport.addChild(container);
    return container;
  }

  private createLanderLabel(lander: Lander) {
    const container = new Container();
    const landerName = new Text(lander.name, {
      fontSize: "10px",
      fill: getLanderColor(lander.color, 11),
      fontFamily: MONO.style.fontFamily
    });
    landerName.name = "landerName";
    landerName.position.y = -3;
    landerName.position.x = lander.radius + 10;
    container.addChild(landerName);

    const landerHealth = new Text(Math.ceil(lander.health), {
      fontSize: "10px",
      fill: tomatoDark.tomato10,
      fontFamily: MONO.style.fontFamily
    });
    landerHealth.name = "landerHealth";
    landerHealth.position.y = -lander.radius - 10;
    landerHealth.position.x = -lander.radius - 10;
    container.addChild(landerHealth);

    this.screenRoot.addChild(container);
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