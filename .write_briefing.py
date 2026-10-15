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

# 选择约 20-25 条写入 briefing
selected = items[:25]

# 按源分组
by_source = {}
for item in selected:
    source = item.get('source', 'Unknown')
    if source not in by_source:
        by_source[source] = []
    by_source[source].append(item)

# 写 briefing.md
with open(os.path.join(output_dir, 'briefing.md'), 'w', encoding='utf-8') as f:
    f.write(f'# 采集日报 {date_str}\n\n')
    f.write(f'**采集时间**: {datetime.now().strftime("%Y-%m-%d %H:%M")}\n\n')
    f.write(f'**成功源**: Hacker News, GitHub Trending, 腾讯新闻, 华尔街见闻\n')
    f.write(f'**失败源**: Product Hunt, Weibo, 36kr, V2EX\n\n')
    f.write(f'**总条目**: {len(items)} 条（选取 {len(selected)} 条）\n\n')
    
    # 按源分组显示
    for source, source_items in by_source.items():
        f.write(f'## {source}\n\n')
        for i, item in enumerate(source_items, 1):
            title = item.get('title', 'Untitled')
            url = item.get('url', '')
            heat = item.get('heat', '')
            time = item.get('time', 'Unknown Time')
            content = item.get('content', '')
            hn_url = item.get('hn_url', '')
            
            # 生成摘要
            if content:
                summary = content[:150] + '...' if len(content) > 150 else content
            else:
                summary = '材料不足，仅标题'
            
            f.write(f'### {i}. [{title}]({url})\n\n')
            f.write(f'- **Time**: {time}\n')
            if heat:
                f.write(f'- **Heat**: {heat}\n')
            if hn_url:
                f.write(f'- **Links**: [Discussion]({hn_url})\n')
            f.write(f'- **Summary**: {summary}\n\n')
        
        f.write('\n')
    
    # 失败源列表
    if failed:
        f.write('## 失败源\n\n')
        for src in failed:
            f.write(f'- ❌ {src}\n')
        f.write('\n')

print('Written briefing.md')
