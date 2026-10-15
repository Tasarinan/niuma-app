#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import os
from datetime import datetime

# 读取采集数据
with open('/tmp/scrap_output.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

items = data['items']
failed = data.get('failed', [])
date_str = '2026-10-15'
output_dir = f'.artifacts/scraps/{date_str}'

# 写 index.json
index = {
    'date': date_str,
    'collected_at': data.get('collectedAt', datetime.now().isoformat()),
    'total_items': len(items),
    'failed_sources': failed,
    'items': []
}

for item in items:
    title = item.get('title', 'Untitled')
    url = item.get('url', '')
    source = item.get('source', 'Unknown')
    time = item.get('time', 'Unknown Time')
    heat = item.get('heat', '')
    
    # 生成文件路径
    safe_title = title.replace('/', '-').replace('\\', '-').replace(':', '-').replace('*', '-).replace('?', '-').replace('"', "'")[:50]
    path = f'{date_str}/{safe_title}.md'
    
    index['items'].append({
        'title': title,
        'url': url,
        'source': source,
        'time': time,
        'heat': heat,
        'path': path
    })

with open(os.path.join(output_dir, 'index.json'), 'w', encoding='utf-8') as f:
    json.dump(index, f, ensure_ascii=False, indent=2)

print('Written index.json')
print(f'Total items: {len(items)}')
