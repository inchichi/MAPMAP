"""Browser regression: input isolation. Planning API is mocked; no model jobs."""
import json
from playwright.sync_api import sync_playwright,expect

requests=[]
def plan(route):
    body=route.request.post_data_json
    requests.append(body)
    result={'id':'test-plan','spec':{'theme':'test','decorations':[],'night':False,'twinkle':False,
            'color':{'gain':[1,1,1],'bias':[0,0,0]},'warnings':[]},'objects':[],'plan':[]}
    if 'document_base64' in body:result['document']={'requirements':[{'text':'test requirement'}]}
    route.fulfill(content_type='application/json',body=json.dumps(result))

with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    page=browser.new_page()
    page.route('**/api/prompt-theme/town-vision/plan',plan)
    page.goto('http://127.0.0.1:15174/editor.html?workspace=style&map=town')
    mode=page.get_by_label('스타일 입력 방식',exact=True)
    analyze=page.get_by_role('button',name='단독 인식 · LLM 계획',exact=True)
    mode.select_option('document')
    analyze.click()
    expect(page.get_by_role('status')).to_contain_text('DOCX를 먼저')
    assert not requests
    page.get_by_label('기획서 DOCX 업로드',exact=True).set_input_files({'name':'fixture.docx','mimeType':'application/octet-stream','buffer':b'test-upload'})
    expect(mode).to_be_enabled()
    analyze.click()
    expect(page.get_by_label('기획서 요구사항 검토 JSON',exact=True)).to_be_visible()
    assert requests[-1]['document_base64']
    mode.select_option('prompt')
    expect(page.get_by_label('기획서 DOCX 업로드',exact=True)).to_be_hidden()
    expect(page.get_by_label('기획서 요구사항 검토 JSON',exact=True)).to_be_hidden()
    expect(page.get_by_role('button',name='스타일 생성하기',exact=True)).to_be_disabled()
    page.get_by_label('테마 프롬프트',exact=True).fill('할로윈 밤 마을')
    analyze.click()
    expect(analyze).to_be_enabled()
    assert len(requests)==2
    assert 'document_base64' not in requests[-1]
    assert 'reviewed_requirements' not in requests[-1]
    mode.select_option('document')
    analyze.click()
    expect(page.get_by_role('status')).to_contain_text('DOCX를 먼저')
    assert len(requests)==2
    browser.close()
print('PASS: missing document blocked; switching clears plan and excludes stale document payload.')
