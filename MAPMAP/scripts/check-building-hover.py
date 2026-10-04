from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path(__file__).resolve().parents[1]/'output/building-hover-check'
out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000})
    page.goto('http://127.0.0.1:15174/editor.html?game=my-sample-rpg&map=town')
    page.get_by_text('building 건물',exact=False).first.click()
    for name,key in [('마을 회관','hall'),('남서쪽 집','house'),('시계탑','clock')]:
        page.get_by_role('button',name=name,exact=False).first.hover()
        canvas=page.locator('.hover-preview canvas')
        canvas.wait_for(state='visible')
        canvas.screenshot(path=str(out/f'{key}.png'))
        page.mouse.move(900,90)
    for group,name,key in [('tree 나무','나무 2','tree'),('prop 소품','소품 2','pot'),('lamp 가로등','가로등 5','lamp')]:
        page.get_by_text(group,exact=False).first.click()
        page.get_by_role('button',name=name,exact=False).first.hover()
        canvas=page.locator('.hover-preview canvas')
        canvas.wait_for(state='visible')
        if key=='pot':
            assert canvas.get_attribute('width')=='32'
            assert canvas.get_attribute('height')=='32'
        canvas.screenshot(path=str(out/f'{key}.png'))
        page.mouse.move(900,90)
    browser.close()
print('PASS: both building previews rendered')
