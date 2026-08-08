"use client";

import { useEffect, useRef } from "react";

type DiamondDitherBackgroundProps = {
  ink?: string;
  pixelSize?: number;
  className?: string;
};

const MAX_CLICKS = 10;

const hexToVec3 = (hex: string): [number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
};

const VERTEX_SHADER = `#version 300 es
  in vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// Ported from the bayer-dithering-webgl-demo "diamonds" shader: an animated
// fbm noise field, ordered-dithered with a Bayer8 matrix, then masked into a
// grid of diamonds. Pointer clicks inject a decaying ripple into the feed.
const FRAGMENT_SHADER = `#version 300 es
  precision highp float;

  uniform vec3  uColor;
  uniform vec2  uResolution;
  uniform float uTime;
  uniform float uPixelSize;
  uniform vec2  uMouse;
  uniform float uMouseIntensity;

  const int MAX_CLICKS = ${MAX_CLICKS};
  uniform vec2  uClickPos[MAX_CLICKS];
  uniform float uClickTimes[MAX_CLICKS];

  out vec4 fragColor;

  float Bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2. + a.y * a.y * .75);
  }
  #define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
  #define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))

  #define FBM_OCTAVES     5
  #define FBM_LACUNARITY  1.25
  #define FBM_GAIN        1.
  #define FBM_SCALE       4.0

  float hash11(float n) { return fract(sin(n) * 43758.5453); }

  float vnoise(vec3 p) {
    vec3 ip = floor(p);
    vec3 fp = fract(p);

    float n000 = hash11(dot(ip + vec3(0.0, 0.0, 0.0), vec3(1.0, 57.0, 113.0)));
    float n100 = hash11(dot(ip + vec3(1.0, 0.0, 0.0), vec3(1.0, 57.0, 113.0)));
    float n010 = hash11(dot(ip + vec3(0.0, 1.0, 0.0), vec3(1.0, 57.0, 113.0)));
    float n110 = hash11(dot(ip + vec3(1.0, 1.0, 0.0), vec3(1.0, 57.0, 113.0)));
    float n001 = hash11(dot(ip + vec3(0.0, 0.0, 1.0), vec3(1.0, 57.0, 113.0)));
    float n101 = hash11(dot(ip + vec3(1.0, 0.0, 1.0), vec3(1.0, 57.0, 113.0)));
    float n011 = hash11(dot(ip + vec3(0.0, 1.0, 1.0), vec3(1.0, 57.0, 113.0)));
    float n111 = hash11(dot(ip + vec3(1.0, 1.0, 1.0), vec3(1.0, 57.0, 113.0)));

    vec3 w = fp * fp * fp * (fp * (fp * 6.0 - 15.0) + 10.0);

    float x00 = mix(n000, n100, w.x);
    float x10 = mix(n010, n110, w.x);
    float x01 = mix(n001, n101, w.x);
    float x11 = mix(n011, n111, w.x);

    float y0 = mix(x00, x10, w.y);
    float y1 = mix(x01, x11, w.y);

    return mix(y0, y1, w.z) * 2.0 - 1.0;
  }

  float fbm2(vec2 uv, float t) {
    vec3 p = vec3(uv * FBM_SCALE, t);
    float amp = 1.;
    float freq = 1.;
    float sum = 1.;

    for (int i = 0; i < FBM_OCTAVES; ++i) {
      sum += amp * vnoise(p * freq);
      freq *= FBM_LACUNARITY;
      amp *= FBM_GAIN;
    }

    return sum * 0.5 + 0.5;
  }

  float maskDiamond(vec2 p, float cov) {
    float r = sqrt(cov) * 0.564;
    return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
  }

  void main() {
    vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
    float aspectRatio = uResolution.x / uResolution.y;

    vec2 pixelUV = fract(fragCoord / uPixelSize);

    float cellPixelSize = 8. * uPixelSize;
    vec2 cellId = floor(fragCoord / cellPixelSize);
    vec2 cellCoord = cellId * cellPixelSize;
    vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);

    // The whole noise field drifts a little toward the cursor, so existing
    // clusters visibly shift instead of only a spot lighting up in place.
    vec2 mouseUV = ((uMouse - uResolution * .5 - cellPixelSize * .5) / uResolution) * vec2(aspectRatio, 1.0);
    vec2 parallax = (mouseUV - uv) * 0.12 * uMouseIntensity;

    float feed = fbm2(uv + parallax, uTime * 0.05);
    feed = feed * 0.5 - 0.65;

    // Broad proximity boost: cells nearer the cursor get denser, cells far
    // away stay as-is, so the reaction reads across the whole visible cloud.
    float mouseDist = distance(uv, mouseUV);
    feed += exp(-mouseDist * mouseDist * 4.5) * 0.55 * uMouseIntensity;

    const float speed = 0.30;
    const float thickness = 0.10;
    const float dampT = 1.0;
    const float dampR = 10.0;

    for (int i = 0; i < MAX_CLICKS; ++i) {
      vec2 pos = uClickPos[i];
      if (pos.x < 0.0) continue;

      vec2 cuv = ((pos - uResolution * .5 - cellPixelSize * .5) / uResolution) * vec2(aspectRatio, 1.0);

      float t = max(uTime - uClickTimes[i], 0.0);
      float r = distance(uv, cuv);

      float waveR = speed * t;
      float ring = exp(-pow((r - waveR) / thickness, 2.0));
      float atten = exp(-dampT * t) * exp(-dampR * r);
      feed = max(feed, ring * atten);
    }

    float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
    float bw = step(0.5, feed + bayer);

    float M = maskDiamond(pixelUV, bw);

    fragColor = vec4(uColor, M);
  }
`;

const createShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

/**
 * Animated diamond-dither background, ported from the bayer-dithering-webgl-demo
 * "diamonds" shader to raw WebGL2 (no three.js dependency). Renders transparent
 * outside the dots, so it composites over whatever sits behind it.
 */
export const DiamondDitherBackground = ({
  ink = "#ffffff",
  pixelSize = 3,
  className,
}: DiamondDitherBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false });
    if (!gl) return;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, "position");
    const resolutionLocation = gl.getUniformLocation(program, "uResolution");
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const colorLocation = gl.getUniformLocation(program, "uColor");
    const pixelSizeLocation = gl.getUniformLocation(program, "uPixelSize");
    const clickPosLocation = gl.getUniformLocation(program, "uClickPos");
    const clickTimesLocation = gl.getUniformLocation(program, "uClickTimes");
    const mouseLocation = gl.getUniformLocation(program, "uMouse");
    const mouseIntensityLocation = gl.getUniformLocation(program, "uMouseIntensity");

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    const clickPositions = Array.from({ length: MAX_CLICKS }, () => [-1, -1]);
    const clickTimes = new Float32Array(MAX_CLICKS);
    let clickIx = 0;

    const handlePointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const fx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const fy = (rect.height - (e.clientY - rect.top)) * (canvas.height / rect.height);

      clickPositions[clickIx] = [fx, fy];
      clickTimes[clickIx] = (performance.now() - startTime) / 1000;
      clickIx = (clickIx + 1) % MAX_CLICKS;
    };
    canvas.addEventListener("pointerdown", handlePointerDown);

    // Pointer position drives a soft glow in the shader (see uMouse /
    // uMouseIntensity above). Target values snap on move; the render loop
    // eases both position and intensity toward them for a trailing feel
    // and a smooth fade in/out instead of a hard on/off cutoff.
    const mouseTarget = { x: -1, y: -1 };
    const mouseSmooth = { x: -1, y: -1 };
    let mouseIntensityTarget = 0;
    let mouseIntensitySmooth = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseTarget.x = (e.clientX - rect.left) * (canvas.width / rect.width);
      mouseTarget.y = (rect.height - (e.clientY - rect.top)) * (canvas.height / rect.height);
      mouseIntensityTarget = 1;
    };
    const handlePointerLeave = () => {
      mouseIntensityTarget = 0;
    };
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);

    const ink3 = hexToVec3(ink);
    const startTime = performance.now();

    const render = () => {
      mouseSmooth.x += (mouseTarget.x - mouseSmooth.x) * 0.15;
      mouseSmooth.y += (mouseTarget.y - mouseSmooth.y) * 0.15;
      mouseIntensitySmooth += (mouseIntensityTarget - mouseIntensitySmooth) * 0.08;

      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, (performance.now() - startTime) / 1000);
      gl.uniform3f(colorLocation, ink3[0], ink3[1], ink3[2]);
      gl.uniform1f(pixelSizeLocation, pixelSize);
      gl.uniform2fv(clickPosLocation, clickPositions.flat());
      gl.uniform1fv(clickTimesLocation, clickTimes);
      gl.uniform2f(mouseLocation, mouseSmooth.x, mouseSmooth.y);
      gl.uniform1f(mouseIntensityLocation, mouseIntensitySmooth);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
      gl.deleteVertexArray(vao);
    };
  }, [ink, pixelSize]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};
