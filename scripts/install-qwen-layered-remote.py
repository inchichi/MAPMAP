"""Isolated remote install; does not load CUDA models or modify FLUX packages."""
import json
import subprocess
import time
from pathlib import Path

ROOT = Path('/home/user6/services/qwen-layered')
ENV = Path('/home/user6/venvs/qwen-layered')
REVISION = '8f0ca708dfff6ba1dd5f2d85d78f8c108a040bcf'


def status(stage, **extra):
    (ROOT/'install-status.json').write_text(json.dumps(dict(stage=stage,updated=time.time(),**extra),indent=2))


def main():
    ROOT.mkdir(parents=True,exist_ok=True)
    try:
        status('creating_environment')
        if not (ENV/'bin/python').exists():
            subprocess.run(['/home/user6/venvs/qwenflux/bin/python','-m','venv',str(ENV)],check=True)
        python=str(ENV/'bin/python')
        status('installing_dependencies')
        subprocess.run([python,'-m','pip','install','torch==2.11.0','diffusers==0.39.0',
                        'transformers==5.14.1','accelerate==1.14.0','bitsandbytes','Pillow','safetensors'],check=True)
        status('downloading_model',revision=REVISION)
        subprocess.run([python,'-c',
            "from huggingface_hub import snapshot_download; snapshot_download('Qwen/Qwen-Image-Layered',"
            f"revision='{REVISION}',local_dir='{ROOT}/model',max_workers=2," 
            "ignore_patterns=['*.md','*.jpg','*.mp4','*.gif'])"],check=True)
        status('verifying_imports')
        subprocess.run([python,'-c',
            "from diffusers import QwenImageLayeredPipeline; import torch, bitsandbytes; "
            "print('QwenImageLayeredPipeline import OK; torch',torch.__version__)"],check=True)
        subprocess.run([python,'-m','pip','freeze'],stdout=(ROOT/'requirements-installed.txt').open('w'),check=True)
        status('complete',revision=REVISION,model_path=str(ROOT/'model'),environment=str(ENV),inference_started=False)
    except Exception as error:
        status('failed',error=str(error))
        raise


if __name__=='__main__': main()
