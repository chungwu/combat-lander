export async function loadRapierWasm() {
  const _wasm = (await import('../node_modules/@dimforge/rapier2d/rapier_wasm2d_bg.wasm')).default;
  // @ts-ignore
  const mod = await import("../node_modules/@dimforge/rapier2d/rapier_wasm2d_bg");
  const instance = new WebAssembly.Instance(_wasm, { "./rapier_wasm2d_bg.js": mod }).exports;
  mod.__wbg_set_wasm(instance);
}
