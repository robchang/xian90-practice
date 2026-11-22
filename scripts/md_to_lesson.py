#!/usr/bin/env python3
"""
Convert markdown daily lessons to JSON format and auto-generate lesson index.

Usage:
  python scripts/md_to_lesson.py input.md day_number

Example:
  python scripts/md_to_lesson.py daily/2026-11-21.md 1

The script will:
1. Convert the markdown to JSON at public/data/lessons/day-{day_number:02d}.json
2. Auto-update public/data/lessons/index.json

Markdown Format Expected:
# Xi'an 90th — Daily study, Day N · Date

**Countdown:** X days to 12 Dec 2026.

## 1. Quick reader — Title
Story content...

**Key sentence:** Chinese
Pinyin
*English*

## 2. Vocabulary (5)
| Word | Pinyin | English | Example |
|---|---|---|---|
| 汉字 | pinyin | English | Example sentence |

## 3. Statement practice: speech lines N–M
1. Chinese
   Pinyin
   *English*

Notes: ...
**Daily run-through:** ...

## 4. Quiz
Question text *(Answer: answer)*
"""

import json
import re
import sys
from pathlib import Path
from datetime import datetime

def parse_markdown_lesson(md_content, day_number, date_str):
    """Parse markdown lesson content into structured JSON."""
    
    lesson = {
        "day": day_number,
        "date": date_str,
        "story": {
            "title": "",
            "content": "",
            "keySentence": {
                "chinese": "",
                "pinyin": "",
                "english": ""
            }
        },
        "vocabulary": [],
        "practiceLines": [],
        "pronunciationTip": "",
        "quiz": []
    }
    
    lines = md_content.strip().split('\n')
    current_section = None
    section_lines = []
    
    for line in lines:
        stripped = line.strip()
        
        if stripped.startswith('## '):
            if current_section and section_lines:
                process_section(lesson, current_section, section_lines)
            current_section = stripped[3:].strip()
            section_lines = []
        else:
            section_lines.append(line)
    
    if current_section and section_lines:
        process_section(lesson, current_section, section_lines)
    
    return lesson

def process_section(lesson, section_name, content_lines):
    """Process a section based on its name."""
    
    text = '\n'.join(content_lines).strip()
    
    if section_name.startswith('1. Quick reader'):
        title_match = re.search(r'1\. Quick reader — (.+)', section_name)
        if title_match:
            lesson['story']['title'] = title_match.group(1).strip()
        
        parts = text.split('**Key sentence:**')
        if len(parts) == 2:
            story_text = parts[0].strip()
            story_text = re.sub(r'\*\(Sources?:.*?\)\*', '', story_text, flags=re.DOTALL).strip()
            lesson['story']['content'] = story_text
            
            key_lines = parts[1].strip().split('\n')
            if len(key_lines) >= 3:
                lesson['story']['keySentence']['chinese'] = key_lines[0].strip()
                lesson['story']['keySentence']['pinyin'] = key_lines[1].strip()
                english = key_lines[2].strip()
                english = re.sub(r'^\*|\*$', '', english)
                lesson['story']['keySentence']['english'] = english
    
    elif section_name.startswith('2. Vocabulary'):
        in_table = False
        for line in text.split('\n'):
            line = line.strip()
            if line.startswith('|') and '---|' not in line:
                parts = [p.strip() for p in line.split('|')[1:-1]]
                if len(parts) >= 4 and parts[0] != 'Word':
                    chinese, pinyin, english, example = parts[0], parts[1], parts[2], parts[3]
                    if chinese and '\u4e00' <= chinese[0] <= '\u9fff':
                        vocab_entry = {
                            "chinese": chinese,
                            "pinyin": pinyin,
                            "english": english
                        }
                        example = re.sub(r'\*[^*]+\*', '', example).strip()
                        if example:
                            vocab_entry["example"] = example
                        lesson['vocabulary'].append(vocab_entry)
    
    elif section_name.startswith('3. Statement practice'):
        lines = text.split('\n')
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if re.match(r'^\d+\.', line):
                chinese = re.sub(r'^\d+\.\s*', '', line).strip()
                pinyin = ""
                english = ""
                
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    if next_line and not next_line.startswith('*') and not re.match(r'^\d+\.', next_line):
                        pinyin = next_line
                        i += 1
                
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    if next_line.startswith('*'):
                        english = re.sub(r'^\*|\*$', '', next_line)
                        i += 1
                
                if chinese:
                    lesson['practiceLines'].append({
                        "chinese": chinese,
                        "pinyin": pinyin,
                        "english": english
                    })
            i += 1
        
        notes_match = re.search(r'Notes?:\s*(.+?)(?=\*\*Daily run-through\*\*|$)', text, re.DOTALL)
        if notes_match:
            lesson['pronunciationTip'] = notes_match.group(1).strip()
    
    elif section_name.startswith('4. Quiz'):
        questions = re.split(r'\n(?=What |How |Which )', text)
        for i, q in enumerate(questions):
            q = q.strip()
            if not q:
                continue
            
            answer_match = re.search(r'\*\(Answer:\s*(.+?)\)\*', q)
            if answer_match:
                question_text = re.sub(r'\s*\*\(Answer:.*?\)\*', '', q).strip()
                answer = answer_match.group(1).strip()
                
                quiz_entry = {
                    "id": f"q{lesson['day']}-{i+1}",
                    "type": "character-to-meaning",
                    "question": question_text,
                    "correct": answer,
                    "options": [answer]
                }
                lesson['quiz'].append(quiz_entry)

def update_lesson_index(lessons_dir, day_number, date, title):
    """Update the lesson index with the new lesson."""
    index_path = lessons_dir / 'index.json'
    
    if index_path.exists():
        with open(index_path, 'r', encoding='utf-8') as f:
            index_data = json.load(f)
    else:
        index_data = {"lessons": []}
    
    lesson_entry = {
        "day": day_number,
        "date": date,
        "title": title,
        "file": f"day-{day_number:02d}.json"
    }
    
    existing = [l for l in index_data['lessons'] if l['day'] != day_number]
    existing.append(lesson_entry)
    existing.sort(key=lambda x: x['day'])
    index_data['lessons'] = existing
    
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, ensure_ascii=False, indent=2)
    
    print(f"✓ Updated lesson index")

def main():
    if len(sys.argv) != 3:
        print("Usage: python md_to_lesson.py <input.md> <day_number>")
        sys.exit(1)
    
    input_file = Path(sys.argv[1])
    day_number = int(sys.argv[2])
    
    if not input_file.exists():
        print(f"Error: File {input_file} not found")
        sys.exit(1)
    
    with open(input_file, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    title_match = re.search(r'^# Xi\'an 90th — Daily study, Day \d+ · (.+)$', md_content, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else f"Day {day_number}"
    
    date_match = re.search(r'\b(\d{4}-\d{2}-\d{2})\b', str(input_file))
    if not date_match:
        date_match = re.search(r'(\d+ \w+ \d{4})', title)
        if date_match:
            from datetime import datetime
            date_str = datetime.strptime(date_match.group(1), '%d %b %Y').strftime('%Y-%m-%d')
        else:
            date_str = datetime.now().strftime('%Y-%m-%d')
    else:
        date_str = date_match.group(1)
    
    lesson = parse_markdown_lesson(md_content, day_number, date_str)
    
    output_dir = Path('public/data/lessons')
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_file = output_dir / f'day-{day_number:02d}.json'
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(lesson, f, ensure_ascii=False, indent=2)
    
    update_lesson_index(output_dir, day_number, date_str, title)
    
    print(f"✓ Converted {input_file} to {output_file}")
    print(f"  Day: {lesson['day']}")
    print(f"  Date: {lesson['date']}")
    print(f"  Title: {lesson['story']['title']}")
    print(f"  Vocabulary: {len(lesson['vocabulary'])} words")
    print(f"  Practice Lines: {len(lesson['practiceLines'])} lines")
    print(f"  Quiz: {len(lesson['quiz'])} questions")

if __name__ == '__main__':
    main()
