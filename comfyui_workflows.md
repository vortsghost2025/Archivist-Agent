# ComfyUI Workflow Specifications for Federation Game

## 1. Planet Albedo Texture (`planet_albedo.json`)

**Goal:** Generate a planet surface texture from seed + biome parameters.

**Inputs:**
- `seed` (int): Deterministic seed for the planet
- `biome` (str): rocky, ice, gas_giant, water_world, lava, desert
- `temperature` (float): Planet temperature in Kelvin
- `star_type` (str): M, K, G, F, A, B, O

**Workflow nodes:**
1. `Load Checkpoint`: `sd_xl_base_1.0.safetensors` (or `flux1-dev.safetensors` if VRAM allows)
2. `CLIP Text Encode` (positive): 
   ```
   A [biome] planet surface, [temperature]K, [star_type]-type star system,
   sci-fi concept art, photorealistic, 8k, detailed texture,
   no atmosphere haze, clean albedo map for game texture
   ```
3. `CLIP Text Encode` (negative): 
   ```
   blurry, low quality, distorted, watermark, text, UI, frame, border
   ```
4. `Empty Latent Image`: 1024x1024 (or 512x512 if VRAM constrained)
5. `KSampler`: steps=20, cfg=7, sampler=euler, scheduler=normal
6. `VAE Decode`
7. `Save Image`

**Prompt template:**
```
A {biome} planet surface, {temperature}K surface temperature, orbiting a {star_type}-type star,
sci-fi concept art, photorealistic, 8k, detailed planetary texture,
no atmosphere haze, clean albedo map suitable for game texture tiling
```

**Negative prompt:**
```
blurry, low quality, distorted, watermark, text, UI, frame, border, lens flare
```

---

## 2. Planet Normal Map (`planet_normal.json`)

**Goal:** Auto-generate normal map from the albedo texture.

**Workflow nodes:**
1. `Load Image`: Load output from `planet_albedo.json`
2. `MiDaS Depth Estimation` (or ` Zoe Depth Estimation` for better quality)
3. `NormalMapGenerator` (custom node or `comfyui_controlnet_aux`):
   - strength=1.0
   - resolution=1024
4. `Save Image`: `{planet_name}_normal.png`

**Alternative:** Use `stable-diffusion-webui`'s `normalmap` script if ComfyUI node is unavailable.

---

## 3. NPC Portrait (`npc_portrait.json`)

**Goal:** Generate consistent NPC faces using IP-Adapter face lock.

**Inputs:**
- `reference_image` (optional): IP-Adapter reference face
- `npc_species` (str): human, alien, synth, etc.
- `npc_role` (str): councilor, captain, scientist, etc.

**Workflow nodes:**
1. `Load Checkpoint`: `sd_xl_base_1.0.safetensors`
2. `Load IP-Adapter Model`: `ip-adapter-plus_sdxl_vit-h.safetensors`
3. `Load CLIP Vision`: `clip_vision_g.safetensors`
4. `IPAdapter Apply`: 
   - weight=0.6
   - weight_faceidv2=0.8 (if using FaceID model)
5. `CLIP Text Encode` (positive):
   ```
   portrait of a {npc_role}, {npc_species}, sci-fi,
   detailed face, studio lighting, neutral background,
   consistent character, front view
   ```
6. `CLIP Text Encode` (negative): same as planet
7. `Empty Latent Image`: 512x512 (portraits are smaller)
8. `KSampler`: steps=25, cfg=7.5
9. `FaceDetailer` (optional): `Ultimate SD Upscale` or `roop` for face refinement
10. `Save Image`

**Prompt template:**
```
portrait of a {npc_role}, {npc_species}, sci-fi setting,
detailed face, studio lighting, neutral background,
consistent character design, front view, headshot
```

---

## 4. Faction Heraldry / Logo (`faction_logo.json`)

**Goal:** Generate faction symbols, banners, heraldry.

**Workflow nodes:**
1. `Load Checkpoint`: `sd_xl_base_1.0.safetensors` (or `flux1-dev`)
2. `CLIP Text Encode` (positive):
   ```
   {faction_name} faction heraldry, {faction_icon},
   sci-fi emblem, vector art style, clean lines, flat colors,
   symmetrical design, military or diplomatic symbol
   ```
3. `CLIP Text Encode` (negative): same as planet
4. `Empty Latent Image`: 512x512
5. `KSampler`: steps=15, cfg=8
6. `Save Image`

**Prompt template:**
```
{faction_name} faction heraldry, {faction_icon},
sci-fi emblem, vector art style, clean lines, flat colors,
symmetrical design, military or diplomatic symbol
```

---

## RTX 5060 8GB VRAM Notes

| Model | Resolution | Batch | VRAM est. |
|-------|-----------|-------|-----------|
| SDXL 1.0 | 1024x1024 | 1 | ~4.5GB |
| SDXL 1.0 | 512x512 | 2 | ~3.5GB |
| Flux Dev | 1024x1024 | 1 | ~6GB |
| Flux Dev | 512x512 | 2 | ~5GB |

**Recommendation:** Start with SDXL 1.0 at 512x512 for batch generation (planet textures). Use Flux Dev only for single high-quality portraits.

---

## Quick Start

1. Install ComfyUI portable:
   ```bash
   cd C:\Users\seand
   git clone https://github.com/comfyanonymous/ComfyUI.git
   cd ComfyUI
   python -m venv venv
   venv\Scripts\activate
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
   pip install -r requirements.txt
   ```

2. Download models to `ComfyUI\models\checkpoints\`:
   - `sd_xl_base_1.0.safetensors` (~7GB)
   - `flux1-dev.safetensors` (~24GB, optional)

3. Copy workflow JSON files to `ComfyUI\user\default\workflows\`

4. Launch: `python main.py` and open `http://localhost:8188`

5. Import workflow JSON via "Load" button
