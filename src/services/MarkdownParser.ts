// src/services/MarkdownParser.ts - FIXED PHRASE MODE
import type { Segment, Chapter, MultilingualContent, PhraseMap, Book, Piece, LibraryItem } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

const SENTENCE_ENDINGS = /[.!?:]\s+|$/g;
const PHRASE_BOUNDARIES = /[,;\-:]/g;

function splitSentenceIntoPhrases(sentence: string): string[] {
  const chunks: string[] = [];
  let lastIndex = 0;

  const matches = [...sentence.matchAll(PHRASE_BOUNDARIES)];
  
  if (matches.length === 0) {
    return [sentence.trim()];
  }

  matches.forEach((match) => {
    const index = match.index!;
    const currentChunk = sentence.slice(lastIndex, index + 1);
    chunks.push(currentChunk);
    lastIndex = index + 1;
  });

  if (lastIndex < sentence.length) {
    chunks.push(sentence.slice(lastIndex));
  }

  return chunks.filter(c => c.trim().length > 0);
}

function pairPhrases(primaryPhrases: string[], secondaryPhrases: string[], primaryLang: string, secondaryLang: string): PhraseMap[] {
  const maxLength = Math.max(primaryPhrases.length, secondaryPhrases.length);
  const pairedPhrases: PhraseMap[] = [];
  
  for (let i = 0; i < maxLength; i++) {
    const phraseMap: PhraseMap = {};
    
    if (i < primaryPhrases.length) {
      phraseMap[primaryLang] = primaryPhrases[i].trim();
    }
    if (i < secondaryPhrases.length) {
      phraseMap[secondaryLang] = secondaryPhrases[i].trim();
    }
    
    // ✅ FIX: Only add non-empty phrase maps
    if (Object.keys(phraseMap).length > 0) {
      pairedPhrases.push(phraseMap);
    }
  }
  
  return pairedPhrases;
}

export function parseMarkdownToSegments(markdown: string, origin: string): Segment[] {
  if (!markdown || markdown.trim() === '') return [];
  
  const [primaryLang, secondaryLang, format] = origin.split('-');
  const isPhraseMode = format === 'ph';
  const isBilingual = !!secondaryLang;
  
  const paragraphs = markdown.split(/\n\n+/);
  const segments: Segment[] = [];
  let segmentOrder = 0;
  
  paragraphs.forEach((paragraph) => {
    const trimmedPara = paragraph.trim();
    if (!trimmedPara) return;
    
    const sentences = trimmedPara.split(SENTENCE_ENDINGS).filter(s => s.trim());
    
    sentences.forEach((sentence, sentenceIndex) => {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) return;
      
      const isNewPara = sentenceIndex === 0;
      const isDialog = /^["']/.test(trimmedSentence);
      
      if (!isBilingual) {
        // ✅ Monolingual: content field is REQUIRED
        segments.push({
          id: generateLocalUniqueId(),
          order: segmentOrder++,
          type: isDialog ? 'dialog' : 'text',
          content: { [primaryLang]: trimmedSentence },
          formatting: {},
          metadata: { isNewPara }
        });
      } else {
        const parts = trimmedSentence.split(/\s+\/\s+/);
        const primaryText = parts[0]?.trim() || '';
        const secondaryText = parts[1]?.trim() || '';
        
        if (!isPhraseMode) {
          // ✅ Bi-Sentence: content field is REQUIRED, phrases is undefined
          const content: MultilingualContent = {};
          if (primaryText) content[primaryLang] = primaryText;
          if (secondaryText) content[secondaryLang] = secondaryText;
          
          segments.push({
            id: generateLocalUniqueId(),
            order: segmentOrder++,
            type: isDialog ? 'dialog' : 'text',
            content,
            phrases: undefined,
            formatting: {},
            metadata: { isNewPara }
          });
        } else {
          // ✅ Bi-Phrase: phrases field is REQUIRED, content is undefined
          if (primaryText && secondaryText) {
            const primaryPhrases = splitSentenceIntoPhrases(primaryText);
            const secondaryPhrases = splitSentenceIntoPhrases(secondaryText);
            const phrases = pairPhrases(primaryPhrases, secondaryPhrases, primaryLang, secondaryLang);
            
            segments.push({
              id: generateLocalUniqueId(),
              order: segmentOrder++,
              type: isDialog ? 'dialog' : 'text',
              content: undefined as any, // ✅ FIX: Must explicitly be undefined for phrase mode
              phrases,
              formatting: {},
              metadata: { isNewPara }
            });
          }
        }
      }
    });
  });
  
  return segments;
}

export function parseBookMarkdown(markdown: string, origin: string): { title: MultilingualContent; chapters: Chapter[] } {
  const lines = markdown.trim().split('\n');
  const [primaryLang, secondaryLang] = origin.split('-');
  
  let title: MultilingualContent = { [primaryLang]: 'Untitled' };
  let currentChapter: Partial<Chapter> | null = null;
  const chapters: Chapter[] = [];
  let contentBuffer = '';
  let foundTitle = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Extract title from H1
    if (trimmedLine.startsWith('# ')) {
      const titleText = trimmedLine.substring(2).trim();
      const titleParts = titleText.split(/\s+\/\s+/);
      title = { [primaryLang]: titleParts[0]?.trim() || 'Untitled' };
      if (secondaryLang && titleParts[1]) {
        title[secondaryLang] = titleParts[1].trim();
      }
      foundTitle = true;
      continue;
    }
    
    // Extract chapter from H2
    if (trimmedLine.startsWith('## ')) {
      // Save previous chapter if exists
      if (currentChapter) {
        const segments = parseMarkdownToSegments(contentBuffer, origin);
        currentChapter.segments = segments;
        currentChapter.stats = {
          totalSegments: segments.length,
          totalWords: segments.reduce((sum, seg) => {
            const text = seg.content?.[primaryLang] || '';
            return sum + text.split(/\s+/).length;
          }, 0),
          estimatedReadingTime: Math.ceil(segments.length / 3)
        };
        chapters.push(currentChapter as Chapter);
        contentBuffer = '';
      }
      
      const chapterTitle = trimmedLine.substring(3).trim();
      const chapterTitleParts = chapterTitle.split(/\s+\/\s+/);
      const chapterTitleObj: MultilingualContent = {
        [primaryLang]: chapterTitleParts[0]?.trim() || `Chapter ${chapters.length + 1}`
      };
      if (secondaryLang && chapterTitleParts[1]) {
        chapterTitleObj[secondaryLang] = chapterTitleParts[1].trim();
      }
      
      currentChapter = {
        id: generateLocalUniqueId(),
        order: chapters.length,
        title: chapterTitleObj,
        segments: [],
        stats: { totalSegments: 0, totalWords: 0, estimatedReadingTime: 0 },
        metadata: {}
      };
      continue;
    }
    
    // Accumulate content for current chapter
    if (currentChapter) {
      contentBuffer += line + '\n';
    }
  }
  
  // Save last chapter
  if (currentChapter) {
    const segments = parseMarkdownToSegments(contentBuffer, origin);
    currentChapter.segments = segments;
    currentChapter.stats = {
      totalSegments: segments.length,
      totalWords: segments.reduce((sum, seg) => {
        const text = seg.content?.[primaryLang] || '';
        return sum + text.split(/\s+/).length;
      }, 0),
      estimatedReadingTime: Math.ceil(segments.length / 3)
    };
    chapters.push(currentChapter as Chapter);
  }
  
  return { title, chapters };
}

export function getItemSegments(item: LibraryItem, chapterIndex: number = 0): Segment[] {
  if (item.type === 'piece') {
    return item.generatedContent || [];
  }
  
  if (item.type === 'book') {
    const chapter = item.chapters[chapterIndex];
    return chapter?.segments || [];
  }
  
  return [];
}