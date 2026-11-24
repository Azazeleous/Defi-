import React, { useEffect, useRef } from 'react';
import { globalVoidController } from '../engine/cosmicGuardianVoidEngine';
import { globalHarmonicEngine } from '../engine/harmonicResonanceEngine';

export const CosmicGuardianVoidCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');

    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    // --- Vector3 Class Polyfill ---
    class Vector3 {
      constructor(public x = 0, public y = 0, public z = 0) {}
      clone() {
        return new Vector3(this.x, this.y, this.z);
      }
      add(v: Vector3) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
      }
      multiplyScalar(s: number) {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        return this;
      }
      divideScalar(s: number) {
        this.x /= s;
        this.y /= s;
        this.z /= s;
        return this;
      }
      dot(v: Vector3) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
      }
    }

    // --- Application State ---
    let currentDepth = 3;
    let currentScale = 2.5;

    // --- Data Repositories ---
    let sierpinskiLinePositions: number[] = [];
    let sierpinskiLineColors: number[] = [];
    let fractalFacetPositions: number[] = [];
    let fractalFacetColors: number[] = [];
    let fractalVertexGems: number[] = [];
    let fractalFaceCenters: number[] = [];
    let fractalEdgePoints: number[] = [];

    // Hypergeometric ring levels (1 to 6)
    const hypergeometricRingLevels = [
      { id: 1, name: 'Tesseract (4D Hypercube)', color: [0.0, 0.94, 1.0], offset: [3.5, 1.0, 2.0] },
      { id: 2, name: '24-Cell (Icositetrachoron)', color: [0.22, 1.0, 0.08], offset: [-3.5, 1.5, 3.0] },
      { id: 3, name: '120-Cell (Hecatonicosachoron)', color: [1.0, 0.72, 0.0], offset: [0.0, 3.5, 4.5] },
      { id: 4, name: '600-Cell (Hexacosichoron)', color: [1.0, 0.0, 0.33], offset: [0.0, -3.5, 3.5] },
      { id: 5, name: 'Great 120-Cell (Hypersphere Torus)', color: [0.55, 0.36, 0.96], offset: [4.0, -2.0, 5.0] },
      { id: 6, name: 'Grand Sephiroth Sphere', color: [1.0, 1.0, 1.0], offset: [-4.0, -2.0, 6.0] },
    ];

    function buildSixSierpinski(center: Vector3, size: number, depth: number) {
      const baseAxes = [
        new Vector3(1, 0, 0),
        new Vector3(-1, 0, 0),
        new Vector3(0, 1, 0),
        new Vector3(0, -1, 0),
        new Vector3(0, 0, 1),
        new Vector3(0, 0, -1),
      ];

      const axisColors = [
        [0.02, 0.71, 0.83], // +X Cyan
        [0.22, 0.74, 0.97], // -X Sky
        [0.96, 0.25, 0.37], // +Y Rose
        [0.98, 0.45, 0.09], // -Y Amber
        [0.06, 0.73, 0.51], // +Z Emerald
        [0.55, 0.36, 0.96], // -Z Violet
      ];

      if (depth === 0) {
        const localVertices = baseAxes.map((axis) => axis.clone().multiplyScalar(size).add(center));

        localVertices.forEach((v) => {
          fractalVertexGems.push(v.x, v.y, v.z);
        });

        for (let i = 0; i < baseAxes.length; i++) {
          for (let j = i + 1; j < baseAxes.length; j++) {
            if (baseAxes[i].dot(baseAxes[j]) === 0) {
              sierpinskiLinePositions.push(localVertices[i].x, localVertices[i].y, localVertices[i].z);
              sierpinskiLinePositions.push(localVertices[j].x, localVertices[j].y, localVertices[j].z);

              const c1 = axisColors[i];
              const c2 = axisColors[j];
              sierpinskiLineColors.push(c1[0], c1[1], c1[2], 0.85);
              sierpinskiLineColors.push(c2[0], c2[1], c2[2], 0.85);
            }
          }
        }

        const triangularFaceCombinations = [
          [0, 2, 4], [0, 2, 5], [0, 3, 4], [0, 3, 5],
          [1, 2, 4], [1, 2, 5], [1, 3, 4], [1, 3, 5],
        ];

        triangularFaceCombinations.forEach((combination, idx) => {
          const v0 = localVertices[combination[0]];
          const v1 = localVertices[combination[1]];
          const v2 = localVertices[combination[2]];

          fractalFacetPositions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);

          const fc = axisColors[idx % axisColors.length];
          fractalFacetColors.push(
            fc[0], fc[1], fc[2], 0.16,
            fc[0], fc[1], fc[2], 0.16,
            fc[0], fc[1], fc[2], 0.16
          );
        });
        return;
      }

      const nextSize = size * 0.5;
      baseAxes.forEach((axis) => {
        buildSixSierpinski(axis.clone().multiplyScalar(size * 0.5).add(center), nextSize, depth - 1);
      });
    }

    function recenterCenterOfMass(positions: number[]) {
      if (positions.length === 0) return { x: 0, y: 0, z: 0 };
      let sx = 0, sy = 0, sz = 0;
      const count = positions.length / 3;
      for (let i = 0; i < positions.length; i += 3) {
        sx += positions[i];
        sy += positions[i + 1];
        sz += positions[i + 2];
      }
      const cx = sx / count;
      const cy = sy / count;
      const cz = sz / count;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] -= cx;
        positions[i + 1] -= cy;
        positions[i + 2] -= cz;
      }
      return { x: cx, y: cy, z: cz };
    }

    function regenerateFractalData() {
      sierpinskiLinePositions = [];
      sierpinskiLineColors = [];
      fractalFacetPositions = [];
      fractalFacetColors = [];
      fractalVertexGems = [];
      fractalFaceCenters = [];
      fractalEdgePoints = [];

      buildSixSierpinski(new Vector3(0, 0, 0), currentScale, currentDepth);

      recenterCenterOfMass(fractalVertexGems);
      recenterCenterOfMass(sierpinskiLinePositions);
      recenterCenterOfMass(fractalFacetPositions);
    }

    regenerateFractalData();

    // --- Shaders ---
    const vsSource = `
      attribute vec3 aPosition;
      attribute vec4 aColor;
      uniform mat4 uMVP;
      uniform float uPointSize;
      uniform float uUseVertexColor;
      uniform vec4 uUniformColor;
      varying vec4 vColor;
      void main() {
        gl_Position = uMVP * vec4(aPosition, 1.0);
        gl_PointSize = uPointSize;
        vColor = mix(uUniformColor, aColor, uUseVertexColor);
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec4 vColor;
      uniform float uIsGemPoint;
      void main() {
        if (uIsGemPoint > 0.5) {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float diamond = abs(coord.x) + abs(coord.y);
          if (diamond > 0.5) discard;
          float facetHighlight = 1.0 - (diamond * 1.4);
          gl_FragColor = vec4(vColor.rgb + vec3(0.25 * facetHighlight), vColor.a);
        } else {
          gl_FragColor = vColor;
        }
      }
    `;

    function createShader(glContext: WebGLRenderingContext, type: number, source: string) {
      const shader = glContext.createShader(type);
      if (!shader) return null;
      glContext.shaderSource(shader, source);
      glContext.compileShader(shader);
      if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
        console.error(glContext.getShaderInfoLog(shader));
        glContext.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const aColor = gl.getAttribLocation(program, 'aColor');
    const uMVP = gl.getUniformLocation(program, 'uMVP');
    const uPointSize = gl.getUniformLocation(program, 'uPointSize');
    const uUseVertexColor = gl.getUniformLocation(program, 'uUseVertexColor');
    const uUniformColor = gl.getUniformLocation(program, 'uUniformColor');
    const uIsGemPoint = gl.getUniformLocation(program, 'uIsGemPoint');

    function createStaticBuffer(glContext: WebGLRenderingContext, data: number[]) {
      const buffer = glContext.createBuffer();
      glContext.bindBuffer(glContext.ARRAY_BUFFER, buffer);
      glContext.bufferData(glContext.ARRAY_BUFFER, new Float32Array(data), glContext.STATIC_DRAW);
      return buffer;
    }

    const lineBuffer = createStaticBuffer(gl, sierpinskiLinePositions);
    const lineColorBuffer = createStaticBuffer(gl, sierpinskiLineColors);
    const facetBuffer = createStaticBuffer(gl, fractalFacetPositions);
    const facetColorBuffer = createStaticBuffer(gl, fractalFacetColors);
    const gemBuffer = createStaticBuffer(gl, fractalVertexGems);

    function getPerspectiveMatrix(fovy: number, aspect: number, near: number, far: number) {
      const f = 1.0 / Math.tan(fovy / 2);
      const nf = 1 / (near - far);
      return [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, (2 * far * near) * nf, 0,
      ];
    }

    function multiplyMatrices(a: number[], b: number[]) {
      const out = new Array(16);
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          let sum = 0;
          for (let i = 0; i < 4; i++) {
            sum += a[row * 4 + i] * b[i * 4 + col];
          }
          out[row * 4 + col] = sum;
        }
      }
      return out;
    }

    // --- Drone Flight Controls & State ---
    const drone = {
      x: 0.0,
      y: 0.0,
      z: 7.5,
      yaw: 0.0,
      pitch: 0.0,
      roll: 0.0,
    };
    let latticeSpinY = 0.0;
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let lastCrossedCoaxial = false;

    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      keys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest?.('.pointer-events-auto')) return;
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      drone.yaw -= (e.clientX - prevMouseX) * 0.004;
      drone.pitch -= (e.clientY - prevMouseY) * 0.004;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };
    const onMouseUp = () => {
      isDragging = false;
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();

    function buildDroneViewMatrix() {
      const cy = Math.cos(-drone.yaw), sy = Math.sin(-drone.yaw);
      const cp = Math.cos(-drone.pitch), sp = Math.sin(-drone.pitch);
      const cr = Math.cos(-drone.roll), sr = Math.sin(-drone.roll);

      const trans = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        -drone.x, -drone.y, -drone.z, 1,
      ];
      const rotY = [
        cy, 0, -sy, 0,
        0, 1, 0, 0,
        sy, 0, cy, 0,
        0, 0, 0, 1,
      ];
      const rotX = [
        1, 0, 0, 0,
        0, cp, sp, 0,
        0, -sp, cp, 0,
        0, 0, 0, 1,
      ];
      const rotZ = [
        cr, sr, 0, 0,
        -sr, cr, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ];

      let view = multiplyMatrices(trans, rotY);
      view = multiplyMatrices(view, rotX);
      view = multiplyMatrices(view, rotZ);
      return view;
    }

    let lastTime = 0;
    let animId = 0;

    const render = (timeMs: number) => {
      const time = timeMs * 0.001;
      const deltaTime = Math.min(0.05, time - lastTime);
      lastTime = time;

      latticeSpinY += deltaTime * 0.15;

      // Handle WSAD + Arrow key flight movement
      const moveSpeed = 5.0 * deltaTime;
      const lookSpeed = 2.0 * deltaTime;

      if (keys['ArrowLeft']) drone.yaw += lookSpeed;
      if (keys['ArrowRight']) drone.yaw -= lookSpeed;
      if (keys['ArrowUp']) drone.pitch += lookSpeed;
      if (keys['ArrowDown']) drone.pitch -= lookSpeed;

      const forwardX = -Math.sin(drone.yaw) * Math.cos(drone.pitch);
      const forwardY = Math.sin(drone.pitch);
      const forwardZ = -Math.cos(drone.yaw) * Math.cos(drone.pitch);

      const rightX = Math.cos(drone.yaw);
      const rightZ = -Math.sin(drone.yaw);

      if (keys['KeyW']) {
        drone.x += forwardX * moveSpeed;
        drone.y += forwardY * moveSpeed;
        drone.z += forwardZ * moveSpeed;
      }
      if (keys['KeyS']) {
        drone.x -= forwardX * moveSpeed;
        drone.y -= forwardY * moveSpeed;
        drone.z -= forwardZ * moveSpeed;
      }
      if (keys['KeyA']) {
        drone.x -= rightX * moveSpeed;
        drone.z -= rightZ * moveSpeed;
      }
      if (keys['KeyD']) {
        drone.x += rightX * moveSpeed;
        drone.z += rightZ * moveSpeed;
      }
      if (keys['KeyE'] || keys['Space']) {
        drone.y += moveSpeed;
      }
      if (keys['KeyQ'] || keys['ShiftLeft']) {
        drone.y -= moveSpeed;
      }

      // Coaxial 0.5 Crossing Acoustic Trigger
      const isNearCoaxial = Math.abs(drone.z - 0.5) < 0.35;
      if (isNearCoaxial && !lastCrossedCoaxial) {
        globalHarmonicEngine.playCoaxialChime();
        lastCrossedCoaxial = true;
      } else if (!isNearCoaxial) {
        lastCrossedCoaxial = false;
      }

      gl.clearColor(0.011, 0.027, 0.071, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      const aspect = gl.canvas.width / gl.canvas.height;
      const projection = getPerspectiveMatrix((45 * Math.PI) / 180, aspect, 0.05, 200);

      // 1. Render Central Sephiroth Hypercube with Dynamic Torsion Shift
      const torsionPhase = Math.sin(time * 0.4) * 0.08;
      const cosM = Math.cos(latticeSpinY + torsionPhase);
      const sinM = Math.sin(latticeSpinY + torsionPhase);
      const modelMatrix = [
        cosM, 0, sinM, 0,
        0, 1, 0, 0,
        -sinM, 0, cosM, 0,
        0, 0, 0, 1,
      ];

      const viewMatrix = buildDroneViewMatrix();
      const modelView = multiplyMatrices(modelMatrix, viewMatrix);
      const mvp = multiplyMatrices(modelView, projection);

      gl.uniformMatrix4fv(uMVP, false, new Float32Array(mvp));
      gl.enableVertexAttribArray(aPosition);

      // Facets
      if (facetBuffer && facetColorBuffer) {
        gl.depthMask(false);
        gl.bindBuffer(gl.ARRAY_BUFFER, facetBuffer);
        gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(aColor);
        gl.bindBuffer(gl.ARRAY_BUFFER, facetColorBuffer);
        gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);

        gl.uniform1f(uUseVertexColor, 1.0);
        gl.uniform1f(uIsGemPoint, 0.0);
        gl.drawArrays(gl.TRIANGLES, 0, fractalFacetPositions.length / 3);
        gl.depthMask(true);
      }

      // Lines
      if (lineBuffer && lineColorBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
        gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(aColor);
        gl.bindBuffer(gl.ARRAY_BUFFER, lineColorBuffer);
        gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);

        gl.uniform1f(uUseVertexColor, 1.0);
        gl.uniform1f(uIsGemPoint, 0.0);
        gl.drawArrays(gl.LINES, 0, sierpinskiLinePositions.length / 3);
      }

      gl.disableVertexAttribArray(aColor);
      gl.uniform1f(uUseVertexColor, 0.0);

      // Gems
      if (gemBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, gemBuffer);
        gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.uniform1f(uPointSize, 6.5);
        gl.uniform1f(uIsGemPoint, 1.0);
        gl.uniform4f(uUniformColor, 0.98, 0.75, 0.14, 0.98);
        gl.drawArrays(gl.POINTS, 0, fractalVertexGems.length / 3);
      }

      // 2. Render Surrounding Hypergeometric Ring Levels (1 to 6)
      hypergeometricRingLevels.forEach((lvl, idx) => {
        const ringAngle = time * 0.3 + (idx * Math.PI * 2) / hypergeometricRingLevels.length;
        const rx = lvl.offset[0] + Math.cos(ringAngle) * 1.5;
        const ry = lvl.offset[1] + Math.sin(ringAngle * 0.7) * 0.8;
        const rz = lvl.offset[2] + Math.sin(ringAngle) * 1.0;

        const levelModel = [
          1, 0, 0, 0,
          0, 1, 0, 0,
          0, 0, 1, 0,
          rx, ry, rz, 1,
        ];
        const levelMV = multiplyMatrices(levelModel, viewMatrix);
        const levelMVP = multiplyMatrices(levelMV, projection);

        gl.uniformMatrix4fv(uMVP, false, new Float32Array(levelMVP));
        gl.uniform1f(uPointSize, 8.0);
        gl.uniform1f(uIsGemPoint, 1.0);
        gl.uniform4f(uUniformColor, lvl.color[0], lvl.color[1], lvl.color[2], 0.95);
        gl.drawArrays(gl.POINTS, 0, Math.min(64, fractalVertexGems.length / 3));
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    globalVoidController.updateStatus({
      rendererMode: 'WEBGL2',
      webgl2Supported: true,
    });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full z-0 pointer-events-auto"
    />
  );
};
