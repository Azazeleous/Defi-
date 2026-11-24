/**
 * CEC HTTP Gateway (Universal)
 * Modes:
 *   A: Roku / FireTV (Network CEC)
 *   B: USB Pulse-Eight CEC adapter (auto detect)
 *   C: Samsung A15 USB Display Bridge (ADB / scrcpy activation)
 */

import { exec } from "child_process";
import util from "util";
const execp = util.promisify(exec);

import { selfHealing } from "../modules/self_healing_interface_mobile.js";

// Snapshot on load
selfHealing.snapshot("cec_gateway_loaded").catch(()=>{});

//////////////////////////////////////////////////////////////////
// UTILITIES
//////////////////////////////////////////////////////////////////
async function tryExec(cmd) {
  try { return { ok:true, ...(await execp(cmd)) }; }
  catch(e){ return { ok:false, error:e.message }; }
}

//////////////////////////////////////////////////////////////////
// MODE A — NETWORK CEC (ROKU)
//////////////////////////////////////////////////////////////////
async function rokuPower(ip, action="PowerOn") {
  try {
    const url = `http://${ip}:8060/keypress/${action}`;
    const r = await fetch(url, { method:"POST" });
    return { ok:r.ok };
  } catch (e) { return { ok:false, error:e.message }; }
}

async function rokuInput(ip, input) {
  const map = {
    "hdmi1": "InputHDMI1",
    "hdmi2": "InputHDMI2",
    "home": "Home"
  };
  const key = map[input] || "Home";
  return rokuPower(ip, key);
}

//////////////////////////////////////////////////////////////////
// MODE A — NETWORK CEC (FIRE TV)
//////////////////////////////////////////////////////////////////
async function firetvCmd(ip, cmd="input keyevent 26") {
  try {
    await execp(`adb connect ${ip}`);
    const { stdout } = await execp(`adb shell ${cmd}`);
    return { ok:true, stdout };
  } catch(e){ return { ok:false, error:e.message }; }
}

//////////////////////////////////////////////////////////////////
// MODE B — USB CEC (Pulse-Eight)
//////////////////////////////////////////////////////////////////
async function cecNative(cmd="standby 0") {
  const cec = await tryExec("which cec-client");
  if (!cec.ok) return { ok:false, error:"CEC adapter not detected" };
  return tryExec(`echo ${cmd} | cec-client -s -d 1`);
}

//////////////////////////////////////////////////////////////////
// MODE C — Samsung A15 USB Bridge
//////////////////////////////////////////////////////////////////
async function samsungActivate() {
  // Activates debugging + scrcpy mirror
  const connect = await tryExec("adb devices");
  if (!connect.ok) return connect;
  return tryExec("scrcpy --turn-screen-off --stay-awake &");
}

//////////////////////////////////////////////////////////////////
// HTTP SERVER (Bun / Node Compatible)
//////////////////////////////////////////////////////////////////
const port = 7684;
if (typeof Bun !== "undefined") {
  Bun.serve({
    port,
    async fetch(req) {
      return handleRequest(req);
    }
  });
  console.log(`CEC Gateway running on :${port}`);
}

export async function handleRequest(req) {
  const url = new URL(req.url, `http://localhost:${port}`);
  const p = url.pathname;

  // /cec/mode
  if (p === "/cec/mode") {
    return new Response(JSON.stringify({ ok: true, modes: ["network-roku", "network-firetv", "usb", "android-usb"] }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // POWER
  if (p === "/cec/power/on") {
    const ip = url.searchParams.get("ip");
    const r1 = await rokuPower(ip, "PowerOn");
    return new Response(JSON.stringify(r1), { headers: { "Content-Type": "application/json" } });
  }
  if (p === "/cec/power/off") {
    const ip = url.searchParams.get("ip");
    const r1 = await rokuPower(ip, "PowerOff");
    return new Response(JSON.stringify(r1), { headers: { "Content-Type": "application/json" } });
  }

  // INPUT SELECT
  if (p === "/cec/input") {
    const ip = url.searchParams.get("ip");
    const input = url.searchParams.get("source") || "hdmi1";
    const r1 = await rokuInput(ip, input);
    return new Response(JSON.stringify(r1), { headers: { "Content-Type": "application/json" } });
  }

  // FIRE TV RAW CMD
  if (p === "/cec/firetv") {
    const ip = url.searchParams.get("ip");
    const cmd = url.searchParams.get("cmd") || "input keyevent 26";
    const r = await firetvCmd(ip, cmd);
    return new Response(JSON.stringify(r), { headers: { "Content-Type": "application/json" } });
  }

  // USB CEC (native)
  if (p === "/cec/native") {
    const cmd = url.searchParams.get("cmd") || "standby 0";
    return new Response(JSON.stringify(await cecNative(cmd)), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Samsung Display Bridge
  if (p === "/cec/bridge/android") {
    return new Response(JSON.stringify(await samsungActivate()), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // STATUS
  if (p === "/cec/status") {
    return new Response(JSON.stringify({ ok: true, service: "CEC Gateway active", timestamp: Date.now() }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response("CEC Gateway Ready", { status: 200 });
}

export { rokuPower, rokuInput, firetvCmd, cecNative, samsungActivate };
