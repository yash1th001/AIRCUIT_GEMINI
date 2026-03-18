import { jsPDF } from 'jspdf';

// ─── Types ────────────────────────────────────────────────────────────────────

type LineType =
  | 'name'
  | 'contact'
  | 'section'
  | 'entry-main'
  | 'entry-sub'
  | 'bullet'
  | 'skills-row'
  | 'text';

interface ResumeLine {
  type: LineType;
  text: string;
  date?: string;
  sub?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTION_KEYWORDS = new Set([
  'objective', 'summary', 'professional summary', 'career objective',
  'education', 'academic background', 'academic qualifications',
  'experience', 'work experience', 'professional experience', 'internship', 'internships', 'employment',
  'projects', 'project', 'personal projects', 'key projects', 'academic projects',
  'skills', 'technical skills', 'core competencies', 'key skills',
  'certifications', 'certification', 'certificates', 'licenses',
  'achievements', 'accomplishments', 'awards', 'honors',
  'languages', 'languages spoken',
  'interests', 'hobbies', 'publications', 'references',
  'extra-curricular', 'extracurricular', 'activities',
  'courses', 'coursework',
]);

const DATE_RE = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s*\d{4}\s*[-–—to]+\s*(?:Present|Current|Expected|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s*\d{4})|\d{4}\s*[-–—to]+\s*(?:Present|Current|Expected|\d{4})|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{4}/gi;

const CONTACT_RE = /@|linkedin\.com|github\.com|^\+?\d[\d\s\-().]{6,}|^Phone:|^Email:|^LinkedIn:|^GitHub:/i;

// ─── FIX 1: Flat-text normaliser ──────────────────────────────────────────────
// When the AI returns the improved resume as a single paragraph (no real \n
// separators), the parser receives one huge line and classifies everything as
// 'text', producing the wall-of-text seen in Image 2.
//
// Strategy: if fewer than 6 lines are found after splitting on \n / \r\n,
// AND the total text is longer than 300 chars, we treat it as a flat blob and
// re-split it by injecting \n before every known section keyword and before
// bullet markers so the parser gets properly-structured input.
// ──────────────────────────────────────────────────────────────────────────────

function normaliseResumeText(raw: string): string {
  // 1. Normalise Windows line endings
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Detect flat blob: split on \n and count non-empty lines
  const existingLines = text.split('\n').filter(l => l.trim().length > 0);

  if (existingLines.length >= 6) {
    // Already properly line-broken — return as-is
    return text;
  }

  // 3. Flat blob detected — inject line breaks before section keywords
  // Build a regex from all section keywords, sorted longest-first to avoid
  // partial matches (e.g. "skills" before "technical skills")
  const kwSorted = [...SECTION_KEYWORDS].sort((a, b) => b.length - a.length);
  const kwPattern = kwSorted
    .map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // escape regex chars
    .join('|');

  // Insert \n before each section keyword (case-insensitive, word boundary)
  text = text.replace(
    new RegExp(`\\s+(${kwPattern})(?=\\s|:)`, 'gi'),
    '\n$1'
  );

  // 4. Insert \n before bullet characters that are mid-sentence
  text = text.replace(/\s+([•\-\*–○▪►])\s+/g, '\n$1 ');

  // 5. Insert \n before lines that look like "Month YYYY" (project/edu dates)
  text = text.replace(
    /([\.\!])\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4})/gi,
    '$1\n$2'
  );

  // 6. Collapse runs of spaces to single space within each segment
  text = text
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l.length > 0)
    .join('\n');

  return text;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseResume(raw: string): ResumeLine[] {
  const result: ResumeLine[] = [];

  // FIX 1 applied: normalise before splitting
  const normalised = normaliseResumeText(raw);

  const lines = normalised
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !/^[=\-]{3,}$/.test(l));

  let nameFound = false;
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase().replace(/[:\-–—*]+$/g, '').trim();

    // ── 1. Name ─────────────────────────────────────────────────────────────
    if (!nameFound) {
      const isContact = CONTACT_RE.test(line);
      const isSectionKw = SECTION_KEYWORDS.has(lower);
      if (!isContact && !isSectionKw && line.length < 60 && !/\d{4}/.test(line)) {
        result.push({ type: 'name', text: line });
        nameFound = true;
        continue;
      }
    }

    // ── 2. Contact line ──────────────────────────────────────────────────────
    if (CONTACT_RE.test(line) && !SECTION_KEYWORDS.has(lower)) {
      result.push({ type: 'contact', text: line });
      continue;
    }

    // ── 3. Section header ────────────────────────────────────────────────────
    if (SECTION_KEYWORDS.has(lower)) {
      currentSection = lower;
      result.push({ type: 'section', text: line.replace(/[:\-–—]+$/, '').trim().toUpperCase() });
      continue;
    }

    // ── 4. Bullet point ──────────────────────────────────────────────────────
    if (/^[•\-\*–○▪►]/.test(line)) {
      result.push({ type: 'bullet', text: line.replace(/^[•\-\*–○▪►]\s*/, '').trim() });
      continue;
    }

    // ── 5. Skills row ────────────────────────────────────────────────────────
    if (
      currentSection.includes('skill') ||
      currentSection.includes('competenc') ||
      /^[A-Za-z ]+:\s+\S/.test(line)
    ) {
      result.push({ type: 'skills-row', text: line });
      continue;
    }

    // ── 6. Entry with date ───────────────────────────────────────────────────
    const dateMatches = [...line.matchAll(new RegExp(DATE_RE.source, 'gi'))];
    if (dateMatches.length > 0) {
      const dateStr = dateMatches.map(m => m[0]).join(' – ');
      const textWithoutDate = line
        .replace(new RegExp(DATE_RE.source, 'gi'), '')
        .replace(/\s*[|\-–—]\s*$/, '')
        .trim();

      const next = lines[i + 1] ?? '';
      const nextLower = next.toLowerCase().replace(/[:\-–—*]+$/g, '').trim();
      const nextIsSection = SECTION_KEYWORDS.has(nextLower);
      const nextIsDate = DATE_RE.test(next);
      const nextIsBullet = /^[•\-\*–○▪►]/.test(next);
      const nextIsContact = CONTACT_RE.test(next);

      if (
        !nextIsSection && !nextIsDate && !nextIsBullet &&
        !nextIsContact && next.length > 0 && next.length < 100
      ) {
        result.push({ type: 'entry-main', text: textWithoutDate, date: dateStr, sub: next });
        i++;
      } else {
        result.push({ type: 'entry-main', text: textWithoutDate, date: dateStr });
      }
      DATE_RE.lastIndex = 0;
      continue;
    }
    DATE_RE.lastIndex = 0;

    // ── 7. Generic text ──────────────────────────────────────────────────────
    result.push({ type: 'text', text: line });
  }

  return result;
}

// ─── PDF Renderer ─────────────────────────────────────────────────────────────

export async function generateResumePdf(resumeText: string): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  const PW = doc.internal.pageSize.getWidth();   // 612
  const PH = doc.internal.pageSize.getHeight();  // 792
  const ML = 45;
  const MR = 45;
  const MT = 45;
  const MB = 45;
  const CW = PW - ML - MR; // 522

  const BLACK: [number, number, number] = [0, 0, 0];
  const BLUE:  [number, number, number] = [0, 70, 180];
  const GRAY:  [number, number, number] = [100, 100, 100];
  const DARK:  [number, number, number] = [30, 30, 30];

  const FS = {
    name:    20,
    contact:  8.5,
    section: 10.5,
    bold:    10,
    italic:   9,
    body:     9,
    small:    8,
  };

  const LH = {
    name:    26,
    contact: 12,
    section: 14,
    bold:    13,
    italic:  11,
    body:    12,
    bullet:  12,
  };

  let y = MT;
  const linkAnnotations: { x: number; y: number; w: number; h: number; url: string }[] = [];

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const newPageIfNeeded = (need: number) => {
    if (y + need > PH - MB) {
      doc.addPage();
      y = MT;
    }
  };

  const rgb = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);

  const drawHRule = () => {
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.6);
    doc.line(ML, y, PW - MR, y);
    y += 1;
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const parsed = parseResume(resumeText);

  for (const item of parsed) {
    switch (item.type) {

      // ── NAME ───────────────────────────────────────────────────────────────
      case 'name': {
        newPageIfNeeded(LH.name + 6);
        doc.setFontSize(FS.name);
        doc.setFont('helvetica', 'bold');
        rgb(BLACK);
        doc.text(item.text, PW / 2, y, { align: 'center' });
        y += LH.name;
        break;
      }

      // ── CONTACT ────────────────────────────────────────────────────────────
      // FIX 2: Set font size BEFORE calling getTextWidth so measurements are
      // accurate. Previously the font might have been at a different size from
      // the previous element, causing totalW to be wrong and the line to start
      // too far left, overflowing the right margin (Image 1 bug).
      case 'contact': {
        newPageIfNeeded(LH.contact + 4);

        // Set font FIRST so getTextWidth uses the correct size
        doc.setFontSize(FS.contact);
        doc.setFont('helvetica', 'normal');

        const parts = item.text
          .split(/\s*\|\s*|\s{2,}/)
          .map(p => p.replace(/^(Phone|Email|LinkedIn|GitHub|Location):\s*/i, '').trim())
          .filter(Boolean);

        const SEP = '  |  ';
        const sepW = doc.getTextWidth(SEP);

        // FIX 2 cont: measure AFTER font is set
        let totalW = 0;
        for (let k = 0; k < parts.length; k++) {
          totalW += doc.getTextWidth(parts[k]);
          if (k < parts.length - 1) totalW += sepW;
        }

        // FIX 3: Clamp cx so line can never overflow the right margin.
        // If the contact line is too wide for the page, fall back to ML.
        let cx = Math.max(ML, (PW - totalW) / 2);
        // Verify it fits; if not, scale approach: just start at ML and let it wrap
        if (cx + totalW > PW - MR + 2) {
          cx = ML;
        }

        for (let k = 0; k < parts.length; k++) {
          const part = parts[k];

          // FIX 4: Re-set font before each getTextWidth call to ensure
          // measurements stay consistent throughout the loop
          doc.setFontSize(FS.contact);
          doc.setFont('helvetica', 'normal');

          const isLink = /https?:\/\/|linkedin\.com|github\.com/i.test(part);

          if (isLink) {
            const url = /https?:\/\//.test(part) ? part : `https://${part}`;
            rgb(BLUE);
            doc.text(part, cx, y);
            const pw = doc.getTextWidth(part);
            doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
            doc.setLineWidth(0.4);
            doc.line(cx, y + 1.5, cx + pw, y + 1.5);
            linkAnnotations.push({ x: cx, y: y - 9, w: pw, h: 11, url });
            rgb(BLACK);
            cx += pw;
          } else {
            rgb(DARK);
            doc.text(part, cx, y);
            cx += doc.getTextWidth(part);
            rgb(BLACK);
          }

          if (k < parts.length - 1) {
            rgb(GRAY);
            doc.text(SEP, cx, y);
            rgb(BLACK);
            cx += sepW;
          }
        }

        y += LH.contact + 3;
        break;
      }

      // ── SECTION HEADER ─────────────────────────────────────────────────────
      case 'section': {
        newPageIfNeeded(LH.section + 12);
        y += 8;
        doc.setFontSize(FS.section);
        doc.setFont('helvetica', 'bold');
        rgb(BLACK);
        doc.text(item.text, ML, y);
        y += 4;
        drawHRule();
        y += 5;
        break;
      }

      // ── ENTRY (Experience / Education / Project) ────────────────────────────
      case 'entry-main': {
        newPageIfNeeded(LH.bold + (item.sub ? LH.italic : 0) + 6);

        const dateStr = item.date ?? '';

        // Measure date width at small size so title max-width is calculated correctly
        let dateW = 0;
        if (dateStr) {
          doc.setFontSize(FS.small);
          doc.setFont('helvetica', 'normal');
          dateW = doc.getTextWidth(dateStr) + 8; // 8pt padding
        }

        const titleMaxW = CW - dateW;

        // Draw bold title
        doc.setFontSize(FS.bold);
        doc.setFont('helvetica', 'bold');
        rgb(BLACK);
        const titleLines = doc.splitTextToSize(item.text, titleMaxW) as string[];
        doc.text(titleLines[0], ML, y);

        // Draw date right-aligned on same baseline as title
        if (dateStr) {
          doc.setFontSize(FS.small);
          doc.setFont('helvetica', 'normal');
          rgb(GRAY);
          doc.text(dateStr, PW - MR, y, { align: 'right' });
          rgb(BLACK);
        }

        y += LH.bold;

        // Additional title wrap lines
        for (let ti = 1; ti < titleLines.length; ti++) {
          doc.setFontSize(FS.bold);
          doc.setFont('helvetica', 'bold');
          rgb(BLACK);
          doc.text(titleLines[ti], ML, y);
          y += LH.bold;
        }

        // Subtitle (italic)
        if (item.sub) {
          doc.setFontSize(FS.italic);
          doc.setFont('helvetica', 'italic');
          rgb(GRAY);
          const subLines = doc.splitTextToSize(item.sub, CW) as string[];
          subLines.forEach(sl => {
            newPageIfNeeded(LH.italic);
            doc.text(sl, ML, y);
            y += LH.italic;
          });
          rgb(BLACK);
        }

        y += 3;
        break;
      }

      // ── BULLET ─────────────────────────────────────────────────────────────
      // FIX 5: Bullet dot must be drawn at the SAME y as the first text line.
      // Previously the dot was drawn, then the forEach loop started — but the
      // loop draws text at y and then advances y, so the dot and the first line
      // were on the same baseline (correct). However, for multi-line bullets,
      // every continuation line needs a page-break check BEFORE drawing.
      case 'bullet': {
        const BX = ML + 9;
        const TX = ML + 18;
        const TW = CW - 18;

        doc.setFontSize(FS.body);
        doc.setFont('helvetica', 'normal');
        rgb(BLACK);

        const bLines = doc.splitTextToSize(item.text, TW) as string[];

        bLines.forEach((bl, bi) => {
          newPageIfNeeded(LH.bullet + 1);
          rgb(BLACK);
          if (bi === 0) {
            // Draw bullet dot on the same line as first text
            doc.text('•', BX, y);
          }
          doc.text(bl, TX, y);
          y += LH.bullet;
        });

        y += 2; // micro-gap after bullet group
        break;
      }

      // ── SKILLS ROW ─────────────────────────────────────────────────────────
      // FIX 6: The original code advanced y inside the vLines loop for vi > 0,
      // then did y += LH.body + 2 unconditionally at the end.
      // For a single-line value this was fine, but for multi-line values the
      // last line already advanced y inside the loop, so the final += double-
      // spaced after every multi-line skills row.
      // Fix: track whether we advanced inside the loop and skip the trailing add.
      case 'skills-row': {
        doc.setFontSize(FS.body);
        const colonIdx = item.text.indexOf(':');

        if (colonIdx > 0 && colonIdx < 40) {
          const label = item.text.slice(0, colonIdx + 1) + ' ';
          const value = item.text.slice(colonIdx + 1).trim();

          doc.setFont('helvetica', 'bold');
          rgb(BLACK);
          const lw = doc.getTextWidth(label);

          doc.setFont('helvetica', 'normal');
          rgb(DARK);
          const vLines = doc.splitTextToSize(value, CW - lw) as string[];

          vLines.forEach((vl, vi) => {
            newPageIfNeeded(LH.body + 2);
            if (vi === 0) {
              // Draw label and first value on same line
              doc.setFont('helvetica', 'bold');
              rgb(BLACK);
              doc.text(label, ML, y);
              doc.setFont('helvetica', 'normal');
              rgb(DARK);
              doc.text(vl, ML + lw, y);
            } else {
              // Continuation lines — indent to align with value column
              doc.text(vl, ML + lw, y);
            }
            y += LH.body;
          });

          // FIX 6: only add trailing gap, NOT another full LH.body
          y += 2;
        } else {
          // No colon — plain text row
          doc.setFont('helvetica', 'normal');
          rgb(DARK);
          const tLines = doc.splitTextToSize(item.text, CW) as string[];
          tLines.forEach(tl => {
            newPageIfNeeded(LH.body + 2);
            doc.text(tl, ML, y);
            y += LH.body;
          });
          y += 2;
        }

        rgb(BLACK);
        break;
      }

      // ── GENERIC TEXT ───────────────────────────────────────────────────────
      case 'text': {
        doc.setFontSize(FS.body);
        doc.setFont('helvetica', 'normal');
        rgb(DARK);
        const txLines = doc.splitTextToSize(item.text, CW) as string[];
        txLines.forEach(tl => {
          newPageIfNeeded(LH.body);
          doc.text(tl, ML, y);
          y += LH.body;
        });
        rgb(BLACK);
        break;
      }
    }
  }

  // ── Clickable link annotations ─────────────────────────────────────────────
  linkAnnotations.forEach(la => {
    doc.link(la.x, la.y, la.w, la.h, { url: la.url });
  });

  doc.save('resume.pdf');
}