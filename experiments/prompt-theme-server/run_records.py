"""Append-only experiment events and a common result-page entry point."""
import json, time


def record_event(folder, event, **details):
    with (folder/'events.jsonl').open('a', encoding='utf8') as f:
        f.write(json.dumps({'at':time.time(), 'event':event, **details}, ensure_ascii=False)+'\n')


def review_html(folder):
    path=folder/'review.html'
    html=path.read_text(encoding='utf8') if path.exists() else '''<!doctype html><html lang="ko"><meta charset="utf-8"><title>스타일 변환 결과</title><style>body{background:#202023;color:#eee;font:16px system-ui;padding:24px}img{max-width:48%;image-rendering:pixelated}a{color:#dfb66d}</style><h1>스타일 변환 결과</h1><p>원본 / 변환 결과 · 생성 기록은 이 실행 폴더에 보존됩니다.</p><img src="original-map.png" alt="원본"><img src="preview.png" alt="변환 결과"></html>'''
    return html+'\n<script type="module" src="/src/editor/themeResultPage.ts"></script>'
