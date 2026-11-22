import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractGlossary() {
  const docxPath = process.argv[2];
  if (!docxPath) {
    console.error('Usage: node docx_to_glossary.js <path-to-glossary.docx>');
    process.exit(1);
  }

  try {
    console.log(`Reading ${docxPath}...`);
    const result = await mammoth.extractRawText({ path: docxPath });
    const text = result.value;
    
    const glossary = [];
    const lines = text.split('\n');
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      const match = line.match(/^(.+?)\s*\(([^)]+)\)\s*[-–—]\s*(.+?)$/);
      if (match) {
        const chinese = match[1].trim();
        const pinyin = match[2].trim();
        const english = match[3].trim();
        
        if (chinese && pinyin && english) {
          glossary.push({
            chinese,
            pinyin,
            english
          });
        }
      }
    }
    
    const outputPath = path.join(__dirname, '..', 'public', 'data', 'glossary.json');
    fs.writeFileSync(outputPath, JSON.stringify(glossary, null, 2));
    
    console.log(`✓ Extracted ${glossary.length} vocabulary words`);
    console.log(`✓ Saved to ${outputPath}`);
    
    if (glossary.length > 0) {
      console.log(`\nFirst entry: ${glossary[0].chinese} (${glossary[0].pinyin}) - ${glossary[0].english}`);
      console.log(`Last entry: ${glossary[glossary.length-1].chinese} (${glossary[glossary.length-1].pinyin}) - ${glossary[glossary.length-1].english}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

extractGlossary();
