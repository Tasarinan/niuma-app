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
os.makedirs(output_dir, exist_ok=True)

# 写每条素材的 Markdown
for i, item in enumerate(items, 1):
    source = item.get('source', 'Unknown')
    title = item.get('title', 'Untitled')
    url = item.get('url', '')
    heat = item.get('heat', '')
    time = item.get('time', 'Unknown Time')
    hn_url = item.get('hn_url', '')
    content = item.get('content', '')
    
    # 清理标题中的特殊字符
    safe_title = title.replace('/', '-').replace('\\', '-').replace(':', '-').replace('*', '-').replace('?', '-').replace('"', "'")[:50]
    filename = f'{i:03d}-{safe_title}.md'
    filepath = os.path.join(output_dir, filename)
    
    # 生成中文摘要
    if content:
        summary = content[:200] + '...' if len(content) > 200 else content
    else:
        summary = '材料不足，仅标题'
    
    # 生成 Deep Dive
    if content and len(content) > 100:
        deep_dive = f'💡 **Insight**: {summary}'
    else:
        deep_dive = '材料不足，仅标题'
    
    # 构建 Links
    links = []
    if hn_url:
        links.append(f'[Discussion]({hn_url})')
    
    # 写入文件
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(f'{url}\n\n')
        f.write(f'#### {i}. [{title}]({url})\n\n')
        f.write(f'- **Source**: {source} | **Time**: {time} | **Heat**: {heat}\n\n')
        if links:
            f.write(f'- **Links**: {" | ".join(links)}\n\n')
        f.write(f'- **Summary**: {summary}\n\n')
        f.write(f'- **Deep Dive**: {deep_dive}\n')
    
    print(f'Written: {filepath}')

print(f'Total items: {len(items)}')
print(f'Output dir: {output_dir}')
