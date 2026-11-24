/**
 * =============================================================================
 * SPECIFICATION: GAIA.NEXUS.HCCGN.QUANTUM-ROSE.V7 (Section 7)
 * MODULE: Cosmic Guardian — Void() Full-App Field State & Shader Controller
 * POLICY:
 *   - Never writes to Save_Memory inside animation frames
 *   - Never bypasses or overrides Gate A = B && C && V
 *   - Supports WebGL2 primary renderer + automatic 2D Canvas fallback
 *   - Respects prefers-reduced-motion & recovers cleanly from webglcontextlost
 * =============================================================================
 */

import type { VoidEngineRuntimeStatus, VoidFieldSettings } from '../contracts/v7-convergence';

type VoidListener = (settings: VoidFieldSettings, status: VoidEngineRuntimeStatus) => void;

export const VOID_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export const VOID_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_time;
uniform float u_intensity;
uniform float u_phase;
uniform float u_hueNorm;
uniform vec2 u_resolution;
out vec4 outColor;

vec3 hslToRgb(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

void main() {
  vec2 uv = (v_uv - 0.5);
  float aspect = u_resolution.x / max(1.0, u_resolution.y);
  uv.x *= aspect;

  float r = length(uv);
  float theta = atan(uv.y, uv.x);

  // Subtle Hamiltonian interference waves over deep obsidian field
  float roseWave = cos(5.0 * theta + u_phase - r * 7.5 + u_time * 0.45);
  float harmonicRing = sin(r * 14.0 - u_time * 0.65 + u_phase * 0.5);
  float curlField = 0.5 + 0.5 * (roseWave * 0.55 + harmonicRing * 0.45);

  float hueA = fract(u_hueNorm + curlField * 0.18 + u_time * 0.015);
  float hueB = fract(hueA + 0.24);
  vec3 c1 = hslToRgb(hueA, 0.78, 0.46);
  vec3 c2 = hslToRgb(hueB, 0.72, 0.36);

  vec3 baseObsidian = vec3(0.018, 0.025, 0.045);
  float radialFade = smoothstep(1.35, 0.08, r);
  vec3 glow = mix(c2, c1, curlField) * (0.08 + 0.22 * u_intensity) * radialFade;

  // Fine hairline resonance filament
  float filament = smoothstep(0.92, 0.99, abs(roseWave)) * 0.08 * u_intensity * radialFade;
  vec3 color = baseObsidian + glow + c1 * filament;

  outColor = vec4(color, 1.0);
}`;

class CosmicGuardianVoidController {
  private settings: VoidFieldSettings = {
    enabled: true,
    fullAppBackdrop: true,
    intensity: 0.78,
    particleDensity: 64,
    phaseCoupling: 0.85,
    maskKind: 'inset',
    paletteSeedHue: 194,
    reducedMotionOverride: 'AUTO',
  };

  private status: VoidEngineRuntimeStatus = {
    rendererMode: 'WEBGL2',
    webgl2Supported: true,
    contextLostCount: 0,
    lastFrameMs: 0,
    fpsEstimate: 60,
    reducedMotionActive: false,
    lastSnapshotUtc: null,
  };

  private listeners = new Set<VoidListener>();

  public getSettings(): VoidFieldSettings {
    return { ...this.settings };
  }

  public getStatus(): VoidEngineRuntimeStatus {
    return { ...this.status };
  }

  public subscribe(fn: VoidListener): () => void {
    this.listeners.add(fn);
    fn(this.getSettings(), this.getStatus());
    return () => {
      this.listeners.delete(fn);
    };
  }

  public updateSettings(partial: Partial<VoidFieldSettings>): void {
    this.settings = {
      ...this.settings,
      ...partial,
      intensity: Math.max(0, Math.min(1, Number(partial.intensity ?? this.settings.intensity))),
      particleDensity: Math.max(16, Math.min(180, Math.round(Number(partial.particleDensity ?? this.settings.particleDensity)))),
      phaseCoupling: Math.max(0, Math.min(1, Number(partial.phaseCoupling ?? this.settings.phaseCoupling))),
      paletteSeedHue: ((Number(partial.paletteSeedHue ?? this.settings.paletteSeedHue) % 360) + 360) % 360,
    };
    this.emit();
  }

  public updateStatus(partial: Partial<VoidEngineRuntimeStatus>): void {
    this.status = { ...this.status, ...partial };
    this.emit();
  }

  public captureRestoreToken(): string {
    const token = JSON.stringify({
      settings: this.settings,
      capturedAtUtc: new Date().toISOString(),
    });
    this.status = { ...this.status, lastSnapshotUtc: new Date().toISOString() };
    this.emit();
    return token;
  }

  public restoreFromToken(rawJson: string): boolean {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed?.settings) {
        this.updateSettings(parsed.settings);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private emit(): void {
    const s = this.getSettings();
    const st = this.getStatus();
    this.listeners.forEach((fn) => fn(s, st));
  }
}

export const globalVoidController = new CosmicGuardianVoidController();
