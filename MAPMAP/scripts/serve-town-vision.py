"""Loopback-only Qwen3-VL inference for the town pipeline; run on dedicated GPU."""
import base64
import io
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import torch
from PIL import Image
from transformers import AutoProcessor, Qwen3VLForConditionalGeneration

MODEL='/home/user6/services/qwen-vl-recognition/model'
if torch.cuda.mem_get_info()[0] < 21*2**30:
    raise RuntimeError('Need 21 GiB free; other services are not stopped')
model=Qwen3VLForConditionalGeneration.from_pretrained(MODEL,dtype=torch.bfloat16,device_map='cuda:0',local_files_only=True).eval()
processor=AutoProcessor.from_pretrained(MODEL,local_files_only=True)


class Handler(BaseHTTPRequestHandler):
    def reply(self,code,data):
        body=json.dumps(data).encode();self.send_response(code)
        self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)))
        self.end_headers();self.wfile.write(body)

    def do_GET(self):
        self.reply(200,{'model':'Qwen3-VL-8B-Instruct','loaded':True})

    def do_POST(self):
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<4_000_000: raise ValueError('Request too large')
            data=json.loads(self.rfile.read(length));content=[]
            if data.get('image'):
                im=Image.open(io.BytesIO(base64.b64decode(data['image'],validate=True))).convert('RGB')
                if max(im.size)>1024:raise ValueError('Image exceeds 1024px')
                content.append({'type':'image','image':im})
            if not isinstance(data.get('prompt'),str) or len(data['prompt'])>16000:raise ValueError('Invalid prompt')
            content.append({'type':'text','text':data['prompt']})
            inputs=processor.apply_chat_template([{'role':'user','content':content}],tokenize=True,
                add_generation_prompt=True,return_dict=True,return_tensors='pt').to('cuda')
            with torch.inference_mode():
                result=model.generate(**inputs,max_new_tokens=min(2048,int(data.get('max_tokens',512))),do_sample=False)
            text=processor.batch_decode(result[:,inputs['input_ids'].shape[1]:],skip_special_tokens=True)[0]
            self.reply(200,{'text':text,'model':'Qwen3-VL-8B-Instruct'})
        except Exception as exc:self.reply(422,{'error':str(exc)})


HTTPServer(('127.0.0.1',8776),Handler).serve_forever()
