from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
out=root/'docs/screenshots/operator-guide-20260928';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    for name,url in [
        ('editor','http://127.0.0.1:15174/editor.html?game=crypt&map=floor-0-town'),
        ('style','http://127.0.0.1:15174/editor.html?workspace=style&game=crypt&map=floor-1-ruins'),
        ('comparison','http://127.0.0.1:15174/theme-runs/92c74d5b208e404b9762c7870b017ada/comparison.html')]:
        page.close()
        page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
        page.goto(url,wait_until='domcontentloaded');page.wait_for_timeout(7000)
        if name=='style': page.get_by_role('button',name='대상 확인',exact=True).wait_for(timeout=30000)
        page.screenshot(path=str(out/f'{name}.png'))
        print(name,page.locator('body').inner_text()[:4500])
        if name=='editor':
            picker=page.get_by_label('결과 선택')
            if picker.count():
                picker.first.select_option('347e49243c004c6588ace0b8c558e8e4')
                page.wait_for_timeout(1500)
                picker.first.scroll_into_view_if_needed()
                page.screenshot(path=str(out/'selection.png'))
        if name=='style':
            page.get_by_role('button',name='대상 확인',exact=True).click()
            page.wait_for_timeout(2500)
            page.screenshot(path=str(out/'plan.png'))
            print('PLAN',page.locator('body').inner_text()[:2500])
    browser.close()
