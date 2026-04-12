/** Matches `reshade_shader_manager.core.manifest.VALID_GRAPHICS_APIS` (v1 manual selection). */
export const GRAPHICS_API_OPTIONS = [
  { data: "dx12", label: "Direct3D 12 (dx12)" },
  { data: "dx11", label: "Direct3D 11 (dx11)" },
  { data: "dx10", label: "Direct3D 10 (dx10)" },
  { data: "dx9", label: "Direct3D 9 (dx9)" },
  { data: "dx8", label: "Direct3D 8 (dx8)" },
  { data: "opengl", label: "OpenGL (opengl)" },
] as const;

export const VARIANT_OPTIONS = [
  { data: "standard", label: "standard (recommended)" },
  { data: "addon", label: "addon" },
] as const;
