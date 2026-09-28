"""One isolated 4-bit Layered pilot on CUDA_VISIBLE_DEVICES=2; no game apply."""
import hashlib, json, time, traceback
from pathlib import Path
import torch
from PIL import Image
from diffusers import QwenImageLayeredPipeline, QwenImageTransformer2DModel, BitsAndBytesConfig
from transformers import Qwen2_5_VLForConditionalGeneration, BitsAndBytesConfig as TextQuant

ROOT=Path('/home/user6/services/qwen-layered/pilot-house-01')
MODEL='/home/user6/services/qwen-layered/model'
start=time.time()


def status(stage,**extra):
    (ROOT/'status.json').write_text(json.dumps(dict(stage=stage,elapsed_seconds=time.time()-start,**extra),indent=2))


def main():
    ROOT.mkdir(exist_ok=True)
    settings=dict(seed=777,layers=4,resolution=640,steps=50,quantization='NF4 transformer and text encoder',
                  input_sha256=hashlib.sha256((ROOT/'input.png').read_bytes()).hexdigest(),
                  prompt='A pixel art orange roof house on a plain gray background, decorated with four small orange pumpkins and fine white cobwebs. Black outlines, windows and a dark doorway.')
    (ROOT/'settings.json').write_text(json.dumps(settings,indent=2))
    try:
        status('loading_transformer')
        quant=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type='nf4',bnb_4bit_compute_dtype=torch.bfloat16)
        transformer=QwenImageTransformer2DModel.from_pretrained(MODEL,subfolder='transformer',torch_dtype=torch.bfloat16,quantization_config=quant,device_map='cuda:0',local_files_only=True)
        status('loading_text_encoder')
        text=Qwen2_5_VLForConditionalGeneration.from_pretrained(MODEL,subfolder='text_encoder',torch_dtype=torch.bfloat16,
            quantization_config=TextQuant(load_in_4bit=True,bnb_4bit_quant_type='nf4',bnb_4bit_compute_dtype=torch.bfloat16),device_map='cuda:0',local_files_only=True)
        pipe=QwenImageLayeredPipeline.from_pretrained(MODEL,transformer=transformer,text_encoder=text,torch_dtype=torch.bfloat16,local_files_only=True)
        pipe.to('cuda')
        pipe.vae.enable_tiling()
        def progress(pipeline,step,timestep,kwargs):
            status('inference',step=step+1,total_steps=50)
            return kwargs
        status('inference',step=0,total_steps=50)
        with torch.inference_mode():
            result=pipe(image=Image.open(ROOT/'input.png').convert('RGBA'),prompt=settings['prompt'],negative_prompt=' ',
                generator=torch.Generator(device='cuda').manual_seed(777),true_cfg_scale=4,num_inference_steps=50,
                layers=4,resolution=640,cfg_normalize=True,use_en_prompt=True,callback_on_step_end=progress)
        for i,layer in enumerate(result.images[0]): layer.save(ROOT/f'layer-{i}.png')
        status('complete',layer_count=len(result.images[0]),peak_gpu_gib=torch.cuda.max_memory_allocated()/2**30)
    except Exception as error:
        status('failed',error=str(error));traceback.print_exc();raise


if __name__=='__main__':main()
