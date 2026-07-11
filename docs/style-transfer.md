# Style Transfer (FreeStyle)

This project now uses a text-guided style transfer flow based on FreeStyle.
The user supplies a content image and a style prompt, not a style reference image.

## Pipeline

1. LLM reads the planning document and outputs structured JSON.
2. The app turns that JSON into a style prompt.
3. A human reviews and approves the prompt.
4. The user picks or generates the base content image.
5. The editor sends the content image and prompt to FreeStyle.
6. The result is reviewed by a human.
7. Optional post-processing runs on the result.
8. The final image is applied to the game asset.

## Main Parts

- `src/editor/createStyleTransferModal.ts`
  - Game editor modal for current project assets and map objects.
  - Sends `style_prompt`, `alpha`, and `alpha_erode` to the style service.
- `src/editor/createExternalSpriteStyler.ts`
  - External project sprite styler.
  - Sends `style_prompt` for single apply and batch apply.
- `style-service/server.py`
  - FastAPI bridge for local style transfer.
  - Exposes the editor endpoints and applies the result back into the workspace.
- `style-service/freestyle_service.py`
  - Wrapper that runs the FreeStyle repo script through `subprocess`.
- `style-service/style_service_config.py`
  - Shared config loader for repo paths and FreeStyle parameters.
- `style-service/config.json`
  - Default paths and FreeStyle hyperparameters.

## API Overview

- `POST /style-transfer`
  - Multipart form
  - Fields: `content`, `style_prompt`, `alpha`, `alpha_erode`, `content_size`, `preserve_size`
- `POST /stylize-object`
  - Stylizes a map object / tileset fragment with a prompt.
- `POST /batch-apply`
  - Batch stylizes multiple game assets with the same prompt.
- `POST /ext/apply`
  - Stylizes one external sprite asset.
- `POST /ext/batch-apply`
  - Stylizes many external sprite assets.
- `GET /health`
  - Checks that the FreeStyle repo and model paths exist.

## Config

`style-service/config.json` uses these keys:

| Key | Meaning |
|---|---|
| `freestyleRepoDir` | Path to the FreeStyle repository root |
| `freestyleDiffusersTestDir` | Folder that contains `stable_diffusion_xl_test.py` |
| `freestyleModelDir` | SDXL model directory inside the FreeStyle repo |
| `freestyleUnetDir` | UNet directory inside the SDXL model folder |
| `freestyleSampler` | Sampler name used by inference |
| `freestyleSteps` | Number of diffusion steps |
| `freestyleCfg` | CFG scale |
| `freestyleNumImagesPerPrompt` | Number of outputs generated per prompt |
| `freestyleN` | FreeStyle `n` parameter |
| `freestyleB` | FreeStyle `b` parameter |
| `freestyleS` | FreeStyle `s` parameter |
| `freestyleSeed` | Random seed |

Environment variables with the `FREESTYLE_` prefix override the config file.

## Run Locally

1. Start the editor.
2. Start the style service from `style-service/`.
3. Open the style transfer modal in the editor.
4. Enter a style prompt, select a content image or asset, and run the transfer.

## Notes

- The service rejects empty prompts.
- FreeStyle is used as a text-guided style transfer backend, so style image upload is no longer part of this flow.
- The result is reviewed before it is applied back to the game.
