from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000})
    page.goto('http://127.0.0.1:15174/editor.html?game=my-sample-rpg&map=town')
    content=page.get_by_role('tab',name='콘텐츠 생성 요청',exact=True)
    style=page.get_by_role('tab',name='스타일 결과·검수',exact=True)
    content.wait_for()
    field=page.locator('#composer-pane-content textarea').first
    field.fill('탭 전환 입력 보존 확인')
    style.click()
    assert page.locator('#composer-pane-style').is_visible()
    assert not page.locator('#composer-pane-content').is_visible()
    assert page.get_by_role('link',name='새 스타일 생성 열기 ↗').get_attribute('href')=='/editor.html?workspace=style&map=town'
    page.wait_for_timeout(2500)
    out=Path(__file__).resolve().parents[1]/'output/composer-tabs.png'
    page.screenshot(path=str(out))
    content.click()
    assert field.input_value()=='탭 전환 입력 보존 확인'
    assert style.get_attribute('aria-selected')=='false'
    print('PASS: panel switching, style link and input preservation')
    browser.close()
