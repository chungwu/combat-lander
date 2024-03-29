import { MONO } from "@/fonts";
import { radianToDegrees, vectorDistance } from "@/utils/math";
import { ensureInstance } from "@/utils/utils";
import { Cuboid, Polyline } from "@dimforge/rapier2d";
import { grayDark, greenDark, tomatoDark, yellowDark } from "@radix-ui/colors";
import assert from "assert";
import { Viewport } from "pixi-viewport";
import { Container, DisplayObject, Graphics, Renderer, Text } from "pixi.js";
import { LANDER_TRAIL_LENGTH, LANDER_TRAIL_LIFE, LANDING_INDICATOR_THRESHOLD, LANDING_PAD_STATS, LANDING_SAFE_ROTATION, LANDING_SAFE_VX, LANDING_SAFE_VY, LanderColor, STEPS_PER_SECOND, WORLD_WIDTH, getLanderColor } from "./constants";
import { LanderGameState } from "./game-state";
import { GameObject } from "./objects/game-object";
import { Ground } from "./objects/ground";
import { Lander } from "./objects/lander";
import { LandingPad } from "./objects/landing-pad";
import { Sky } from "./objects/sky";
import { Rocket } from "./rocket";

type RenderedObjects = [Container, Container, Container];

function isPortrait() {
  return window.innerHeight > window.innerWidth * 1.5;
}

export class CanvasRenderer {
  id2gfx: Map<string, RenderedObjects>;
  id2label: Map<string, DisplayObject | null>;
  renderer: Renderer;
  root: Container;
  viewport: Viewport;
  screenRoot: Container;
  curGameId: string | undefined;
  id2trails: Map<string, RenderedObjects[]>;
  prevLanderColors: Map<string, LanderColor>

  constructor() {
    this.id2gfx = new Map();
    this.id2label = new Map();
    this.id2trails = new Map();
    this.prevLanderColors = new Map();
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

  private clearContainer(container: Container) {
    for (const child of this.screenRoot.children) {
      child.destroy();
    }
    container.removeChildren();
  }

  private reset() {
    this.clearContainer(this.screenRoot);
    this.clearContainer(this.viewport);
    this.id2gfx.clear();
    this.id2label.clear();
    this.id2trails.clear();
  }

  private updateLegend(game: LanderGameState) {
    let legend = this.screenRoot.getChildByName("legend");
    if (!legend) {
      legend = new Container();
      legend.name = "legend";
      this.screenRoot.addChild(legend);
      for (let i=0; i<1000; i+= 100) {
        const text = new Text(`${game.moon.worldHeight - i}`, {
          fill: "#FFFFFF",
          fontSize: 12,
          fontFamily: MONO.style.fontFamily
        });
        text.x = 10; 
        text.y = this.viewport.toScreen(0, i).y;
        (legend as Container).addChild(text);
      }
    }
    assert(legend instanceof Container);
    for (let i=0; i<10; i++) {
      const child = ensureInstance(legend.getChildAt(i), Text);
      child.y = this.viewport.toScreen(0, i * 100).y;
    }
  }

  resize() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
    this.viewport.screenWidth = window.innerWidth;
    this.viewport.screenHeight = window.innerHeight;
  }

  render(game: LanderGameState, playerId: string, time: number) {
    if (!this.curGameId || this.curGameId !== game.id) {
      // Game changed!  Clear everything
      this.reset();
      this.curGameId = game.id;
      this.viewport.worldWidth = game.moon.worldWidth;
    }

    if (game.landers.some(l => this.prevLanderColors.has(l.id) && l.color !== this.prevLanderColors.get(l.id))) {
      // Some lander has changed colors!  Reset everything to draw them the right
      // color. A bit dramatic but too lazy to do something fine-grained.
      this.reset();
    }

    this.updateViewport(game, playerId);
    const seenHandles = new Set<string>();

    const handleObject = (object: GameObject) => {
      seenHandles.add(object.id);
      let gfxs = this.id2gfx.get(object.id);
      if (!gfxs) {
        const main = this.createObjectGraphics(object, game);
        const left = this.createObjectGraphics(object, game);
        const right = this.createObjectGraphics(object, game);
        gfxs = [main, left, right];
        this.id2gfx.set(object.id, gfxs);
      } else {
        const [main, left, right] = gfxs;
        this.updateObjectGraphics(object, main);
        this.updateObjectGraphics(object, left);
        this.updateObjectGraphics(object, right);
      }
      updateObjectGraphicsPositions(object, gfxs);
      
      if (!this.id2label.has(object.id)) {
        const label = this.createObjectLabel(object);
        if (label) {
          this.id2label.set(object.id, label);
        } else {
          this.id2label.set(object.id, null);
        }
      }
      const label = this.id2label.get(object.id);
      if (label) {
        this.updateObjectLabel(game, object, label, playerId);
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
      // The object's x position that is currently visible on the screen may be
      // the main, left, or right copy.  So for the label, we need to get the screen
      // coordinate of the correct copy
      let displayedX = object.x;
      if (this.viewport.left < 0 && object.x >= game.moon.worldWidth + this.viewport.left) {
        // Here, the viewport's left is rendering the end of the left copy, and we see
        // that the object is indeed within that slice. So we use the left copy's x
        displayedX = object.x - game.moon.worldWidth;
      }
      if (this.viewport.right > game.moon.worldWidth && object.x < this.viewport.right - game.moon.worldWidth) {
        // Here, the viewport's right is rendering the start of the right copy, and 
        // the object is indeed within that slice. So we use the right copy's x
        displayedX = object.x + game.moon.worldWidth;
      }
      const screenPos = this.viewport.toScreen(
        displayedX, game.moon.worldHeight - object.y
      );
      label.position.x = screenPos.x;
      label.position.y = screenPos.y;
    };
    
    handleObject(game.ground);
    handleObject(game.sky);
    for (const lander of game.landers) {
      handleObject(lander);
      this.updateLanderTrails(game, lander, time);
    }
    for (const rocket of game.rockets) {
      handleObject(rocket);
    }
    for (const pad of game.landingPads) {
      handleObject(pad);
    }

    for (const [ id, gfxs ] of Array.from(this.id2gfx.entries())) {
      if (!seenHandles.has(id)) {
        this.destroyRelatedGraphics(id);
      }
    }

    this.updateLegend(game);

    this.renderer.render(this.root);

    this.prevLanderColors.clear();
    for (const lander of game.landers) {
      this.prevLanderColors.set(lander.id, lander.color);
    }
  }
  
  private destroyRelatedGraphics(id: string) {
    const gfxs = this.id2gfx.get(id);
    if (gfxs) {
      for (const gfx of gfxs) {
        gfx.destroy();
        this.viewport.removeChild(gfx);
      }
    }
    this.id2gfx.delete(id);

    const gfx = this.id2label.get(id);
    if (gfx) {
      gfx.destroy();
      this.screenRoot.removeChild(gfx);
    }

    const trails = this.id2trails.get(id);
    if (trails) {
      for (const trail of trails) {
        for (const gfx of trail) {
          gfx.destroy();
          this.viewport.removeChild(gfx);
        }
      }
    }
  }

  private updateViewport(game: LanderGameState, playerId: string) {
    this.viewport.worldHeight = game.moon.worldHeight;

    const minZoom = this.viewport.screenWidth / this.viewport.worldWidth;
    const focusedLanderId = game.wonPlayer ? game.wonPlayer.playerId : playerId;
    const focusedLander = focusedLanderId ? game.landers.find(l => l.id === focusedLanderId) : undefined;
    if (focusedLander && focusedLander.isAlive()) {
      this.viewport.scaled = Math.max(1, minZoom);

      // selfLander is to the left of the viewport left edge, so it must have
      // been just transported / wrapped; transport the viewport as well
      if (focusedLander.translation.x < this.viewport.left) {
        this.viewport.left -= game.moon.worldWidth;
      }

      // Similarly, selfLander is to the right of the viewport right edge,
      // so it was also transported; follow as well
      if (focusedLander.translation.x > this.viewport.right) {
        this.viewport.right += game.moon.worldWidth;
      }

      const marginX = this.viewport.screenWidthInWorldPixels * 0.3;
      this.viewport.left = Math.min(this.viewport.left, focusedLander.translation.x - marginX);
      this.viewport.right = Math.max(this.viewport.right, focusedLander.translation.x + marginX);

      const marginYTop = this.viewport.screenHeightInWorldPixels * 0.2;
      this.viewport.top = Math.min(this.viewport.top, (this.viewport.worldHeight - focusedLander.translation.y) - marginYTop);
      
      // Move the viewport bottom to follow the lander down, but don't move
      // lower than 200 past ground level in portrait mode, so we can make
      // use of all that vertical real estate.
      const marginYBottom = this.viewport.screenHeightInWorldPixels * 0.6;
      const minBottom = isPortrait() ? this.viewport.worldHeight + 200 : this.viewport.worldHeight + 50;
      this.viewport.bottom = Math.min(minBottom, Math.max(
        this.viewport.bottom, 
        (this.viewport.worldHeight - focusedLander.translation.y) + marginYBottom,
      ));
    } else {
      this.viewport.scaled = minZoom;
      this.viewport.bottom = game.moon.worldHeight;
      this.viewport.left = 0;
    }
  }

  private createObjectGraphics(object: GameObject, game: LanderGameState) {
    const gfx = (() => {
      if (object instanceof Lander) {
        return this.createLanderGraphics(object, game);
      } else if (object instanceof Ground) {
        return this.createGroundGraphics(object);
      } else if (object instanceof Sky) {
        return this.createSkyGraphics(object);
      } else if (object instanceof Rocket) {
        return this.createRocketGraphics(object);
      } else if (object instanceof LandingPad) {
        return this.createLandingPadGraphics(object);
      } else {
        throw new Error(`Unknown game object ${object}`);
      }
    })();
    this.viewport.addChild(gfx);
    return gfx;
  }

  private createObjectLabel(object: GameObject) {
    const gfx = (() => {
      if (object instanceof Lander) {
        return this.createLanderLabel(object);
      } else {
        return undefined;
      }
    })();
    if (gfx) {
      this.screenRoot.addChild(gfx);
    }
    return gfx;
  }

  private updateObjectGraphics(object: GameObject, gfx: Graphics | Container) {
    if (object instanceof Lander) {
      this.updateLanderGraphics(object, gfx);
    }
  }

  private updateObjectLabel(
    game: LanderGameState, object: GameObject, gfx: DisplayObject, playerId: string) {
    if (object instanceof Lander) {
      this.updateLanderLabel(game, object, gfx, playerId);
    }
  }

  private updateLanderGraphics(
    lander: Lander, container: Container
  ) {
    const flame = ensureInstance(container.getChildByName("flame"), Graphics);
    const LANDER_LENGTH = lander.radius * 2;
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

    const healthGauge = ensureInstance(container.getChildByName("healthGauge"), Graphics);
    healthGauge.clear();
    drawLanderHealthGauge(lander, healthGauge);

    const fuelGauge = ensureInstance(container.getChildByName("fuelGauge"), Container);
    const fuelMeter = ensureInstance(fuelGauge.getChildByName("fuelMeter"), Graphics);
    fuelMeter.clear();
    drawLanderFuelMeter(lander, fuelMeter);

    if (!lander.isAlive()) {
      container.alpha = 0.5;
    }
  }

  private updateLanderTrails(game: LanderGameState, lander: Lander, time: number) {
    const stepsPerDot = LANDER_TRAIL_LIFE / LANDER_TRAIL_LENGTH * STEPS_PER_SECOND;
    if (time % stepsPerDot === 0) {
      let trails = this.id2trails.get(lander.id);
      if (!trails) {
        trails = [];
        this.id2trails.set(lander.id, trails);
      }
      let newTrail: RenderedObjects;
      if (trails.length === LANDER_TRAIL_LENGTH) {
        newTrail = trails.shift()!;
      } else {
        const createDot = () => {
          const gfx = new Graphics();
          gfx.beginFill(getLanderColor(lander.color, 10));
          gfx.drawCircle(0, 0, 1);
          this.viewport.addChild(gfx);
          return gfx;
        };
        newTrail = [createDot(), createDot(), createDot()];
      }
      trails.push(newTrail);

      newTrail.forEach((gfx, i) => {
        gfx.position.x = (
          i === 0 ? lander.x :
          i === 1 ? lander.x - game.moon.worldWidth :
          lander.x + game.moon.worldWidth
        );
        gfx.position.y = this.viewport.worldHeight - lander.y;
      });

      trails.forEach((dots, i) => {
        dots.forEach(gfx => {
          gfx.alpha = i / trails!.length;
        });
      });
    }
  }

  private updateLanderLabel(game: LanderGameState, lander: Lander, gfx: DisplayObject, playerId: string) {
    assert(gfx instanceof Container);
    const landerName = ensureInstance(gfx.getChildByName("landerName"), Text);
    if (landerName.text !== lander.name) {
      landerName.text = lander.name;
    }
    // don't need to show your own name
    if (playerId === lander.id) {
      landerName.visible = false;
    }

    const landerHealth = ensureInstance(gfx.getChildByName("landerHealth"), Text);
    if (landerHealth.text !== `${Math.ceil(lander.health)}`) {
      landerHealth.text = `${Math.ceil(lander.health)}`;
    }

    let landingIndicator = ensureInstance(gfx.getChildByName("landingIndicator"), Container);
    const pad = game.findClosestPad(lander);
    const distance = vectorDistance(pad, lander);
    if (
      (lander.id === playerId && distance < LANDING_INDICATOR_THRESHOLD) ||
      (game.wonPlayer?.reason === "landed" && game.wonPlayer.playerId === lander.id)
    ) {
      landingIndicator.visible = true;

      const angleText = ensureInstance(landingIndicator.getChildAt(0), Text); 
      const vxText = ensureInstance(landingIndicator.getChildAt(1), Text);
      const vyText = ensureInstance(landingIndicator.getChildAt(2), Text);

      const safeColor = greenDark.green10;
      const dangerColor = tomatoDark.tomato10;

      const updateIndicators = (rotation: number, vx: number, vy: number) => {
        const angle = Math.abs(radianToDegrees(rotation));
        angleText.text = `Angle: ${angle.toFixed(2)}°`
        angleText.style.fill = Math.abs(rotation) > LANDING_SAFE_ROTATION ? dangerColor : safeColor;
  
        vxText.text = `Speed X: ${Math.abs(vx).toFixed(2)}`;
        vxText.style.fill = Math.abs(vx) > LANDING_SAFE_VX ? dangerColor : safeColor;
  
        vyText.text = `Speed Y: ${Math.abs(vy).toFixed(2)}`;
        vyText.style.fill = Math.abs(vy) > LANDING_SAFE_VY ? dangerColor : safeColor;
      }

      if (game.wonPlayer?.reason === "landed" && game.wonPlayer.playerId === lander.id) {
        const stats = game.wonPlayer.landedStats;
        updateIndicators(stats.rotation, stats.vx, stats.vy);
      } else {
        updateIndicators(lander.rotation, lander.body.linvel().x, lander.body.linvel().y);
      }
    } else {
      landingIndicator.visible = false;
      landerHealth.visible = true;
    }

    if (!lander.isAlive()) {
      gfx.alpha = 0.5;
    }

    // We show lander health gauge now instead of text
    landerHealth.visible = false;
  }

  private createLanderGraphics(lander: Lander, game: LanderGameState) {    
    const container = new Container();

    const LANDER_LENGTH = lander.radius * 2;

    const shuttle = new Graphics();
    shuttle.name = "shuttle";

    const cockpit = new Graphics();
    cockpit.name = "cockpit";
    shuttle.addChild(cockpit);
    shuttle.lineStyle(2, getLanderColor(lander.color, 10));
    drawPolyline(shuttle, SHUTTLE_SHAPES.cockpit, LANDER_LENGTH);

    shuttle.lineStyle(1, grayDark.gray11);
    drawSegments(shuttle, [
      SHUTTLE_SHAPES.middle,
      SHUTTLE_SHAPES.booster,
      SHUTTLE_SHAPES.leftLeg,
      SHUTTLE_SHAPES.rightLeg,
      SHUTTLE_SHAPES.leftFoot,
      SHUTTLE_SHAPES.rightFoot,
    ], LANDER_LENGTH);

    const flame = new Graphics();
    flame.name = "flame";

    const healthGauge = new Graphics();
    healthGauge.name = "healthGauge";
    drawLanderHealthGauge(lander, healthGauge);
    if (game.options.infiniteHealth) {
      healthGauge.visible = false;
    }

    const fuelGauge = new Container();
    fuelGauge.name = "fuelGauge";
    const fuelMeter = new Graphics();
    fuelMeter.name = "fuelMeter";
    fuelGauge.addChild(fuelMeter);
    const fuelGaugeMask = new Graphics();
    fuelGauge.addChild(fuelGaugeMask);
    fuelGaugeMask.beginFill("#ffffff");
    fuelGaugeMask.drawPolygon(SHUTTLE_SHAPES.booster.map(([x, y]) => ({x: x * LANDER_LENGTH, y: y * LANDER_LENGTH})));
    fuelGauge.mask = fuelGaugeMask;
    drawLanderFuelMeter(lander, fuelMeter);
    if (game.options.infiniteFuel) {
      fuelGauge.visible = false;
    }

    container.addChild(healthGauge);
    container.addChild(flame);
    container.addChild(fuelGauge);
    container.addChild(shuttle);

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
    landerHealth.position.y = -lander.radius - 13;
    landerHealth.position.x = -lander.radius - 13;
    container.addChild(landerHealth);

    const landingIndicator = new Container();
    landingIndicator.name = "landingIndicator";

    const textHeight = 10;
    const angleText = new Text(``, {
      fontSize: `${textHeight}px`,
      fontFamily: MONO.style.fontFamily,
    });
    landingIndicator.addChild(angleText);

    const vxText = new Text(``, {
      fontSize: `${textHeight}px`,
      fontFamily: MONO.style.fontFamily,
    });
    vxText.position.y = textHeight;
    landingIndicator.addChild(vxText);

    const vyText = new Text(``, {
      fontSize: `${textHeight}px`,
      fontFamily: MONO.style.fontFamily,
    });
    vyText.position.y = textHeight + textHeight
    landingIndicator.addChild(vyText);

    landingIndicator.position.x = -lander.radius - 10;
    landingIndicator.position.y = -lander.radius - (textHeight * 3) - 10;
    container.addChild(landingIndicator);

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
    return gfx;
  }

  private createLandingPadGraphics(pad: LandingPad) {
    const width = LANDING_PAD_STATS[pad.type].width;

    const container = new Container();
    const gfx = new Graphics();
    container.addChild(gfx);
    gfx.lineStyle(2, yellowDark.yellow10);
    gfx.moveTo(0, 0);
    gfx.lineTo(width, 0);

    const text = new Text(`${LANDING_PAD_STATS[pad.type].multiplier}x`, {
      fontFamily: MONO.style.fontFamily,
      fontSize: "10px",
      fill: grayDark.gray11,
      align: "center"
    });
    text.position.x = width / 2 - 6;
    text.position.y = 5;
    container.addChild(text);

    return container;
  }
}

function drawSegments(gfx: Graphics, segments: (readonly (readonly [number, number])[])[], scale: number = 1) {
  for (const section of segments) {
    drawPolyline(gfx, section, scale);
  }
}

function drawPolyline(gfx: Graphics, vertices: readonly (readonly [number, number])[], scale: number = 1) {
  if (vertices.length >= 2) {
    gfx.moveTo(vertices[0][0] * scale, vertices[0][1] * scale);
  }
  for (let i=1; i<vertices.length; i++) {
    gfx.lineTo(vertices[i][0] * scale, vertices[i][1] * scale);
  }
}

function drawLanderHealthGauge(lander: Lander, healthGauge: Graphics) {
  const LANDER_LENGTH = lander.radius * 2;
  healthGauge.beginFill(tomatoDark.tomato8);
  healthGauge.drawRect(
    SHUTTLE_SHAPES.middle[0][0] * LANDER_LENGTH,
    SHUTTLE_SHAPES.middle[0][1] * LANDER_LENGTH,
    (SHUTTLE_SHAPES.middle[2][0] - SHUTTLE_SHAPES.middle[0][0]) * LANDER_LENGTH * (lander.health / 100),
    (SHUTTLE_SHAPES.middle[2][1] - SHUTTLE_SHAPES.middle[0][1]) * LANDER_LENGTH,
  );
}

function drawLanderFuelMeter(lander: Lander, fuelMeter: Graphics) {
  const LANDER_LENGTH = lander.radius * 2;
  fuelMeter.beginFill(getLanderColor(lander.color, 8));
  fuelMeter.drawRect(
    SHUTTLE_SHAPES.booster[1][0] * LANDER_LENGTH,
    SHUTTLE_SHAPES.booster[0][1] * LANDER_LENGTH,
    (SHUTTLE_SHAPES.booster[2][0] - SHUTTLE_SHAPES.booster[1][0]) * LANDER_LENGTH * (lander.fuel / 100),
    (SHUTTLE_SHAPES.booster[2][1] - SHUTTLE_SHAPES.booster[0][1]) * LANDER_LENGTH,
  );
}

export default CanvasRenderer;

const SHUTTLE_SHAPES = {
  cockpit: [
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
  middle: [
    [-.45, 0],
    [.45, 0],
    [.45, .2],
    [-.45, .2],
    [-.45, 0]
  ],
  booster: [
    [-.2, .2],
    [-.3, .45],
    [.3, .45],
    [.2, .2],
    [-.2, .2],
  ],
  rightLeg: [
    [.35, .2],
    [.45, .5],
  ],
  leftLeg: [
    [-.35, .2],
    [-.45, .5],
  ],
  rightFoot: [
    [.5, .5],
    [.4, .5],
  ],
  leftFoot: [
    [-.5, .5],
    [-.4, .5],
  ]
} as const;