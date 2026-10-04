from pathlib import Path
import sys
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')

out=Path(__file__).resolve().parents[1]/'output/town-vision-check'
out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000})
    for name,url in [('town','http://127.0.0.1:15174/editor.html?game=my-sample-rpg&map=town'),('style','http://127.0.0.1:15174/editor.html?workspace=style&map=town')]:
        page.goto(url,wait_until='domcontentloaded')
        page.wait_for_timeout(6000)
        page.screenshot(path=str(out/f'{name}.png'))
        print(name,page.locator('body').inner_text()[:3500])
        if name=='style':
            assert page.get_by_role('button',name='단독 인식 · LLM 계획',exact=True).count()==1
    browser.close()
