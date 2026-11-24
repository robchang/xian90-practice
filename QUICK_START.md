# Quick Start Guide

## What You Have

A complete, production-ready Progressive Web App for Mandarin speech practice, specifically designed for Rob Chang's Xi'an Incident 90th anniversary commemoration speech.

## Running Locally

```bash
cd mandarin-speech-app
npm install
npm run dev
```

The app will be available at http://localhost:5173

## Current Status

✅ **Fully Built and Tested**
- All 6 screens implemented and functional
- PWA-ready with offline support
- Speech recognition and scoring (browser-dependent)
- Spaced repetition quiz system
- Progress tracking with export/import
- Beautiful Chinese-inspired UI

✅ **Sample Content Included**
- 13-line commemoration speech with pinyin and English
- Day 1 lesson with vocabulary and quiz
- 37-word glossary from the speech
- Content pipeline ready for more lessons

## File Structure

```
mandarin-speech-app/
├── README.md               # Complete documentation
├── DEPLOYMENT.md           # 5 deployment options
├── public/
│   ├── data/
│   │   ├── speech.json     # The 13 speech lines
│   │   ├── glossary.json   # Vocabulary words
│   │   └── lessons/        # Daily lessons
│   └── icon-*.png          # PWA icons
├── src/
│   ├── screens/            # All 6 screens
│   ├── types.ts
│   ├── storage.ts
│   ├── scoring.ts
│   └── spacedRepetition.ts
└── scripts/
    └── md_to_lesson.py     # Convert markdown to lesson JSON
```

## Adding New Lessons

### Quick Method
1. Create `daily/2026-11-22.md` following the format in README
2. Run: `python scripts/md_to_lesson.py daily/2026-11-22.md 2`
3. Update `public/data/lessons/index.json`
4. Rebuild: `npm run build`

### Manual Method
Create `public/data/lessons/day-02.json` directly (see README for format)

## Deployment (Choose One)

### Easiest: Netlify Drop
1. `npm run build`
2. Go to https://app.netlify.com/drop
3. Drag `dist` folder
4. Done! Get instant URL

### GitHub Pages
1. Push to GitHub
2. Add GitHub Actions workflow (see DEPLOYMENT.md)
3. Enable Pages in repo settings
4. Auto-deploys on every push

### Other Options
- Vercel CLI: `vercel --prod`
- Cloudflare Pages: Connect repo
- Surge: `cd dist && npx surge`

See DEPLOYMENT.md for detailed instructions.

## Browser Compatibility

✅ **Full Support** (All features including speech recognition)
- Chrome/Edge on Desktop & Android

✅ **Good Support** (Recording works, manual scoring available)
- Safari on iOS/macOS
- Firefox on Desktop & Android

⚠️ **Limitations**
- iOS Safari: No Web Speech API (uses self-rating fallback)
- Firefox: No Web Speech API (uses self-rating fallback)

## Key Features

1. **Today Screen**
   - Countdown to Dec 12, 2026
   - Daily lesson with story, vocab, tips
   - Quick quiz preview

2. **Speech Screen**
   - All 13 lines with toggleable pinyin/English
   - Per-line audio playback
   - Shadowing mode (play → pause → repeat)
   - Podium view for rehearsal

3. **Record & Score**
   - Record with microphone
   - Automatic syllable-level scoring
   - Visual feedback (initial/final/tone accuracy)
   - Pitch contour visualization
   - Self-rating fallback when needed

4. **Quiz Screen**
   - Spaced repetition (SM-2 algorithm)
   - Multiple quiz modes
   - Tracks accuracy and due dates

5. **Archive Screen**
   - Browse all past lessons
   - View completed days

6. **Progress Screen**
   - Practice streak
   - Per-line best scores
   - Export/import data as JSON

## Customization

### Colors
Edit `src/App.css` CSS variables:
```css
--deep-red: #8B0000;
--ivory: #FFFEF0;
--ink-black: #1a1a1a;
```

### Fonts
Currently uses Noto Serif SC / Noto Sans SC from Google Fonts.

### Target Date
Edit `App.tsx` line with:
```typescript
const targetDate = new Date('2026-12-12T00:00:00+08:00');
```

## Support

For questions about:
- **App features**: See README.md
- **Deployment**: See DEPLOYMENT.md
- **Content format**: See scripts/md_to_lesson.py comments

## Next Steps

1. ✅ App is ready to use
2. 📝 Add more daily lessons as needed
3. 🎵 (Optional) Add pre-recorded audio files
4. 🚀 Deploy to your preferred hosting service
5. 📱 Share URL with Rob for daily practice

## Repository

The code is ready at: /agent/repos/tmp-81727681db9ebd14/mandarin-speech-app

Once you create a permanent repository, you can:
1. Copy this directory to your new repo
2. Push to GitHub/GitLab
3. Set up automatic deployment
4. Share the live URL

Built with ❤️ for the 90th anniversary of the Xi'an Incident.
