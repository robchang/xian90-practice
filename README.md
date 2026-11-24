# Xi'an 90 Mandarin Practice App

A polished, mobile-first Progressive Web App (PWA) designed to help Rob Chang (张居信) prepare for delivering a 13-line Mandarin speech at the Xi'an Incident 90th anniversary commemoration in Beijing on December 12, 2026.

## Features

### 📅 Today Screen
- Countdown to December 12, 2026
- Daily lesson with story, vocabulary, practice lines, pronunciation tips
- Quick quiz preview
- Daily reminders

### 📜 Speech Screen
- All 13 lines of the commemoration speech
- Toggleable pinyin and English translations
- Per-line audio playback (browser TTS fallback)
- Shadowing mode: listen → pause → repeat → advance
- Large-font podium view for rehearsal

### 🎤 Record & Score
- Record each line using your device microphone
- Side-by-side playback: your recording vs. reference
- Automatic scoring using Web Speech API (zh-CN):
  - Syllable-level analysis (initial/final/tone)
  - Character-by-character color-coded feedback
  - Pitch contour visualization
- Graceful fallback: self-rating when speech recognition unavailable
- Tracks best and recent scores per line

### ✏️ Quiz Screen
- Spaced repetition vocabulary drill (SM-2 algorithm)
- Multiple modes:
  - Character → Pinyin/Meaning
  - Pinyin → Character
  - Audio → Character/Meaning
  - Mixed
- Tracks accuracy and progress

### 📚 Archive Screen
- Browse and review all past daily lessons
- View completed lessons and current progress

### 📊 Progress Screen
- Practice streak counter
- Total recordings and quiz attempts
- Per-line best scores
- Vocabulary review progress
- Export/Import progress data as JSON

## Technology Stack

- **Frontend**: Vite + React + TypeScript
- **Styling**: Custom CSS with Chinese-inspired design (deep red, ivory, ink black)
- **Fonts**: Noto Serif SC / Noto Sans SC
- **Storage**: IndexedDB via localforage
- **PWA**: Vite PWA plugin with Workbox
- **Audio**: Web Audio API, MediaRecorder API, Web Speech API
- **Pinyin Processing**: pinyin-pro library

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.7+ (for content conversion scripts)

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The dev server runs on http://localhost:5173 by default.

## Adding New Daily Lessons

### Option 1: Using the Python Converter

1. Create a markdown file following this format:

```markdown
---
date: 2026-11-22
title: Your Lesson Title
---

# Story
Your story content here...

# Vocabulary
- 汉字 (pinyin) - English translation
  Example: 例句在这里

- 另一个字 (lìng yí gè zì) - Another word
  Example: 这是例句

# Practice Lines
1. 第一句练习
2. 第二句练习

# Pronunciation Tip
Your pronunciation tip here...

# Quiz
Q: 汉字
A: pinyin
Options: pinyin, wrong1, wrong2, wrong3
Type: character-to-pinyin

Q: Another question
A: Correct answer
Options: option1, option2, option3, option4
Type: character-to-meaning
```

2. Run the converter:

```bash
python scripts/md_to_lesson.py daily/2026-11-22.md 2
```

3. Update `public/data/lessons/index.json` to include the new lesson:

```json
{
  "lessons": [
    {
      "day": 1,
      "date": "2026-11-21",
      "title": "Greetings & Introduction",
      "file": "day-01.json"
    },
    {
      "day": 2,
      "date": "2026-11-22",
      "title": "Your New Lesson",
      "file": "day-02.json"
    }
  ]
}
```

4. (Optional) Add audio files:
   - Place MP3 files in `public/audio/daily/day-02/`
   - Update the lesson JSON with audio paths

### Option 2: Manual JSON Creation

Create `public/data/lessons/day-XX.json` directly:

```json
{
  "day": 2,
  "date": "2026-11-22",
  "story": {
    "title": "Lesson Title",
    "content": "Story content..."
  },
  "vocabulary": [
    {
      "chinese": "词",
      "pinyin": "cí",
      "english": "word",
      "example": "这是一个词"
    }
  ],
  "practiceLines": [
    "练习句子一",
    "练习句子二"
  ],
  "pronunciationTip": "Your tip here...",
  "quiz": [
    {
      "id": "q2-1",
      "type": "character-to-pinyin",
      "question": "词",
      "correct": "cí",
      "options": ["cí", "chí", "cì", "cǐ"]
    }
  ]
}
```

## Pinyin Conventions

This app follows specific pinyin conventions for accuracy:

- **Tone Sandhi**: Shown for 一 and 不
  - 不怕死 → bú pà sǐ (not bù)
  - 一岁 → yí suì (not yī)
  - 一直 → yìzhí (changes to 4th tone before 4th tone)

- **Neutral Tones**: Unmarked
  - 孙子 → sūnzi (not sūnzǐ)
  - 故事 → gùshi (not gùshì)

- **3rd + 3rd Tone**: NOT changed in display
  - 很好 → hěn hǎo (both shown as 3rd tone)

- **Scoring**: Accepts both citation and sandhi tones for 一/不 and 3rd+3rd pairs

## Browser Support

### Required Features:
- **Basic**: All modern browsers (Chrome, Firefox, Safari, Edge)
- **MediaRecorder API**: Chrome 47+, Firefox 25+, Safari 14.1+, Edge 79+
- **Web Speech API (zh-CN)**: Chrome 33+, Edge 79+ (NOT Firefox or Safari)

### Fallback Behavior:
- **No MediaRecorder**: App will disable recording features
- **No Web Speech API**: Manual self-rating with 1-5 stars available
- **No speechSynthesis**: Audio playback for vocabulary quiz disabled (visual mode still works)

### Best Experience:
- **Desktop**: Chrome or Edge (full speech recognition support)
- **Mobile**: Chrome on Android (full support)
- **iOS**: Safari (recording works, speech recognition uses self-rating)

## Deploying to GitHub Pages

1. Update `vite.config.ts` base path if deploying to a subdirectory:

```typescript
export default defineConfig({
  base: '/your-repo-name/',  // Change this
  // ...
})
```

2. Build and deploy:

```bash
# Build the app
npm run build

# Deploy to GitHub Pages (using gh-pages package)
npm install -D gh-pages
npx gh-pages -d dist
```

3. Or use GitHub Actions (create `.github/workflows/deploy.yml`):

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install and Build
        run: |
          npm ci
          npm run build
          
      - name: Deploy
        uses: JamesIves/github-pages-deploy-action@v4
        with:
          folder: dist
          branch: gh-pages
```

## Deploying to Other Static Hosts

### Netlify
```bash
npm run build
# Drag and drop the `dist` folder to Netlify
```

### Vercel
```bash
npm run build
vercel --prod
```

### Cloudflare Pages
```bash
npm run build
# Connect your repo or upload the `dist` folder
```

## Development Notes

### Project Structure
```
mandarin-speech-app/
├── public/
│   ├── data/
│   │   ├── speech.json              # The 14 speech lines
│   │   ├── glossary.json            # ~65 vocabulary words
│   │   └── lessons/
│   │       ├── index.json           # Lesson index
│   │       ├── day-01.json          # Daily lessons
│   │       └── ...
│   ├── audio/                       # Audio files (optional)
│   └── icon-*.png                   # PWA icons
├── src/
│   ├── screens/                     # Screen components
│   ├── types.ts                     # TypeScript interfaces
│   ├── storage.ts                   # IndexedDB operations
│   ├── scoring.ts                   # Speech scoring logic
│   ├── spacedRepetition.ts          # SM-2 algorithm
│   ├── App.tsx                      # Main app component
│   └── App.css                      # Styles
└── scripts/
    └── md_to_lesson.py              # Markdown to JSON converter
```

### Adding Audio Files

To add pre-recorded audio:

1. Place audio files in `public/audio/` following this structure:
```
public/audio/
├── lines/
│   ├── line_01.mp3
│   ├── line_02.mp3
│   └── ...
└── daily/
    ├── day-01/
    │   ├── vocab_word1.mp3
    │   └── ...
    └── day-02/
        └── ...
```

2. Update `speech.json` to reference audio:
```json
{
  "number": 1,
  "chinese": "...",
  "pinyin": "...",
  "english": "...",
  "audioUrl": "/audio/lines/line_01.mp3"
}
```

3. Update lesson JSON files similarly for vocabulary audio.

## Credits

Built for Rob Chang (张居信) to honor the legacy of his great-grandfather, General Zhang Xueliang (张学良), and commemorate the 90th anniversary of the Xi'an Incident.

## License

MIT License - Feel free to adapt for your own language learning needs.
