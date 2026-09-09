# Style Transfer (SDXL)

The local style service uses `stabilityai/stable-diffusion-xl-base-1.0` with `StableDiffusionXLImg2ImgPipeline`.
The user supplies a content image and a natural-language style prompt.

## Pipeline

1. The editor creates or selects a content image.
2. The user reviews a style prompt.
3. The editor sends the content image and prompt to the SDXL img2img service.
4. The result is reviewed and can be applied to the game asset.

## Main Parts

- `src/editor/createStyleTransferModal.ts`
  - Sends content images and style prompts to the style service.
- `style-service/sdxl_service.py`
  - Loads the SDXL img2img pipeline once per service process.
  - Preserves source alpha channels and asset dimensions where required.
- `style-service/server.py`
  - FastAPI bridge for the editor endpoints.
- `style-service/style_service_config.py`
  - Loads SDXL model and inference settings.

## API

The existing editor endpoints remain unchanged:

- `POST /style-transfer`
- `POST /stylize-object`
- `POST /batch-apply`
- `POST /ext/apply`
- `POST /ext/batch-apply`
- `GET /health`

## Baseline configuration

| Key | Meaning |
|---|---|
| `sdxlModel` | `stabilityai/stable-diffusion-xl-base-1.0` |
| `sdxlDevice` | PyTorch device, normally `cuda` or `cpu` |
| `sdxlSteps` | Number of inference steps |
| `sdxlGuidanceScale` | Prompt guidance scale |
| `sdxlStrength` | How strongly the prompt changes the content image |
| `sdxlSeed` | Reproducible seed |

Environment variables with the `SDXL_` prefix override the config file.

LoRA and ControlNet are intentionally not enabled in this baseline. They can be added after the SDXL img2img flow is validated.

## Run locally

1. Install the Python dependencies in `style-service/requirements.txt` and a compatible PyTorch build.
2. Start the service from `style-service/`.
3. Start the editor and open the SDXL style-transfer modal.

The first generation downloads and loads the model, so it can take longer and requires a compatible GPU and sufficient VRAM.
