// Local TF-IDF based resume analyzer - no external API needed

interface AnalysisResult {
  atsScore: number;
  jdMatchScore?: number;
  structureScore: number;
  hasJobDescription: boolean;
  suggestions: {
    additions: string[];
    removals: string[];
    improvements: string[];
  };
  structureAnalysis: {
    sections: { name: string; status: "good" | "needs-improvement" | "missing"; feedback: string }[];
    formatting: string[];
  };
  candidateContext?: {
    name: string;
    currentRole: string;
    yearsExperience: string;
    topSkills: string[];
  };
  keyFindings?: {
    strongMatches: string[];
    criticalGaps: string[];
    quickWins: string[];
  };
}

// Common ATS keywords grouped by category
const ATS_KEYWORDS = {
  action_verbs: [
    'achieved', 'managed', 'led', 'developed', 'created', 'implemented', 'designed',
    'analyzed', 'improved', 'increased', 'decreased', 'optimized', 'delivered',
    'coordinated', 'executed', 'established', 'launched', 'streamlined', 'built',
    'drove', 'generated', 'negotiated', 'resolved', 'trained', 'collaborated'
  ],
  technical_skills: [
    'javascript', 'python', 'java', 'react', 'node', 'sql', 'aws', 'azure', 'docker',
    'kubernetes', 'git', 'agile', 'scrum', 'api', 'rest', 'graphql', 'typescript',
    'html', 'css', 'mongodb', 'postgresql', 'redis', 'machine learning', 'ai',
    'data analysis', 'excel', 'powerpoint', 'tableau', 'power bi', 'salesforce'
  ],
  soft_skills: [
    'leadership', 'communication', 'teamwork', 'problem-solving', 'analytical',
    'project management', 'time management', 'collaboration', 'adaptability',
    'critical thinking', 'decision making', 'organizational', 'attention to detail'
  ],
  section_headers: [
    'experience', 'education', 'skills', 'summary', 'objective', 'projects',
    'certifications', 'achievements', 'awards', 'publications', 'languages',
    'professional experience', 'work experience', 'technical skills', 'core competencies'
  ]
};

// Tokenize text into words
function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

// Calculate term frequency
function calculateTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  tokens.forEach(token => {
    tf.set(token, (tf.get(token) || 0) + 1);
  });
  // Normalize by total tokens
  const total = tokens.length;
  tf.forEach((count, term) => {
    tf.set(term, count / total);
  });
  return tf;
}

// Calculate TF-IDF similarity between resume and job description
function calculateTFIDFSimilarity(resumeText: string, jobDescription: string): number {
  const resumeTokens = tokenize(resumeText);
  const jdTokens = tokenize(jobDescription);
  
  const resumeTF = calculateTF(resumeTokens);
  const jdTF = calculateTF(jdTokens);
  
  // Get all unique terms from JD
  const jdTerms = new Set(jdTokens);
  
  // Count how many JD terms appear in resume with their relative importance
  let matchScore = 0;
  let totalWeight = 0;
  
  jdTerms.forEach(term => {
    const jdFreq = jdTF.get(term) || 0;
    const resumeFreq = resumeTF.get(term) || 0;
    
    // Weight by how important the term is in JD
    const weight = jdFreq * 10;
    totalWeight += weight;
    
    if (resumeFreq > 0) {
      matchScore += weight * Math.min(resumeFreq / jdFreq, 1);
    }
  });
  
  return totalWeight > 0 ? (matchScore / totalWeight) * 100 : 50;
}

// Check for section presence
function detectSections(text: string): { name: string; present: boolean; quality: "good" | "needs-improvement" | "missing" }[] {
  const textLower = text.toLowerCase();
  
  const sections = [
    { name: "Contact Information", patterns: ['email', 'phone', 'linkedin', '@', 'tel:'] },
    { name: "Professional Summary", patterns: ['summary', 'objective', 'profile', 'about me'] },
    { name: "Work Experience", patterns: ['experience', 'employment', 'work history', 'professional experience'] },
    { name: "Skills", patterns: ['skills', 'skill', 'competencies', 'technical skills', 'core competencies'] },
    { name: "Education", patterns: ['education', 'academic', 'degree', 'university', 'college'] },
    { name: "Certifications", patterns: ['certification', 'certified', 'certificate', 'license'] }
  ];
  
  return sections.map(section => {
    const found = section.patterns.some(pattern => textLower.includes(pattern));
    return {
      name: section.name,
      present: found,
      quality: found ? "good" : "missing" as "good" | "needs-improvement" | "missing"
    };
  });
}

// Calculate ATS score based on various factors
function calculateATSScore(resumeText: string): { score: number; details: string[] } {
  const textLower = resumeText.toLowerCase();
  const tokens = tokenize(resumeText);
  const details: string[] = [];
  let score = 0;
  
  // Check for contact information (15 points)
  const hasEmail = textLower.includes('@') && textLower.match(/[\w.-]+@[\w.-]+\.\w+/);
  const hasPhone = textLower.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/) || textLower.match(/\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/);
  
  if (hasEmail) { score += 5; details.push("✓ Email found"); }
  else details.push("✗ Missing email");
  
  if (hasPhone) { score += 5; details.push("✓ Phone number found"); }
  else details.push("✗ Missing phone number");
  
  // Check for location (5 points)
  const locationPatterns = ['city', 'state', 'location', 'address', /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/];
  const hasLocation = locationPatterns.some(p => typeof p === 'string' ? textLower.includes(p) : p.test(resumeText));
  if (hasLocation) { score += 5; details.push("✓ Location found"); }
  
  // Check for summary section (10 points)
  const summaryPatterns = ['summary', 'objective', 'profile'];
  if (summaryPatterns.some(p => textLower.includes(p))) {
    score += 10;
    details.push("✓ Summary section found");
  }
  
  // Check for experience section (15 points)
  if (textLower.includes('experience')) {
    score += 15;
    details.push("✓ Experience section found");
  }
  
  // Check for education (10 points)
  if (textLower.includes('education') || textLower.includes('degree') || textLower.includes('university')) {
    score += 10;
    details.push("✓ Education section found");
  }
  
  // Check for skills section (10 points)
  if (textLower.includes('skills') || textLower.includes('skill')) {
    score += 10;
    details.push("✓ Skills section found");
  }
  
  // Check for action verbs (15 points)
  const actionVerbCount = ATS_KEYWORDS.action_verbs.filter(verb => textLower.includes(verb)).length;
  const actionVerbScore = Math.min(actionVerbCount * 1.5, 15);
  score += actionVerbScore;
  if (actionVerbCount >= 5) {
    details.push(`✓ Good use of action verbs (${actionVerbCount} found)`);
  } else {
    details.push(`✗ Add more action verbs (only ${actionVerbCount} found)`);
  }
  
  // Check for quantifiable achievements (10 points)
  const hasNumbers = resumeText.match(/\d+%|\$\d+|\d+\+|\d+ (years|months|projects|clients|team)/gi);
  if (hasNumbers && hasNumbers.length >= 3) {
    score += 10;
    details.push("✓ Good quantifiable achievements");
  } else {
    details.push("✗ Add more numbers and metrics");
  }
  
  // Check for standard formatting (5 points)
  const bulletPoints = resumeText.match(/[•\-\*]/g);
  if (bulletPoints && bulletPoints.length >= 5) {
    score += 5;
    details.push("✓ Good use of bullet points");
  }
  
  return { score: Math.min(Math.round(score), 100), details };
}

// Calculate structure score
function calculateStructureScore(resumeText: string): { score: number; formatting: string[] } {
  const formatting: string[] = [];
  let score = 0;
  
  const sections = detectSections(resumeText);
  const presentSections = sections.filter(s => s.present).length;
  score += (presentSections / sections.length) * 30;
  
  // Check for bullet points (15 points)
  const bulletMatches = resumeText.match(/[•\-\*]\s/g);
  if (bulletMatches && bulletMatches.length >= 10) {
    score += 15;
    formatting.push("Good use of bullet points");
  } else {
    formatting.push("Use more bullet points for achievements");
  }
  
  // Check for consistent formatting (15 points)
  const lines = resumeText.split('\n').filter(l => l.trim());
  if (lines.length >= 20) {
    score += 15;
    formatting.push("Resume has adequate length");
  } else {
    formatting.push("Consider adding more detail");
  }
  
  // Check for quantified achievements (15 points)
  const metrics = resumeText.match(/\d+%|\$[\d,]+|[\d,]+ (users|customers|clients|team|projects)/gi);
  if (metrics && metrics.length >= 3) {
    score += 15;
    formatting.push("Good quantified achievements");
  } else {
    formatting.push("Add more numbers and metrics to achievements");
  }
  
  // Check for date ranges (10 points)
  const dateRanges = resumeText.match(/(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}|(19|20)\d{2}\s*[-–]\s*(present|current)/gi);
  if (dateRanges && dateRanges.length >= 2) {
    score += 10;
    formatting.push("Date ranges are present");
  } else {
    formatting.push("Include date ranges for positions");
  }
  
  // Check spacing and readability (15 points)
  const hasGoodSpacing = resumeText.includes('\n\n') || lines.length > 15;
  if (hasGoodSpacing) {
    score += 15;
    formatting.push("Good spacing and readability");
  } else {
    formatting.push("Add more white space between sections");
  }
  
  return { score: Math.min(Math.round(score), 100), formatting };
}

// Extract candidate context
function extractCandidateContext(resumeText: string): { name: string; currentRole: string; yearsExperience: string; topSkills: string[] } {
  const lines = resumeText.split('\n').filter(l => l.trim());
  const textLower = resumeText.toLowerCase();
  
  // Try to find name (usually first line or near contact info)
  let name = "Not detected";
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length < 50 && !firstLine.includes('@') && !firstLine.match(/\d{3}/)) {
      name = firstLine;
    }
  }
  
  // Find role titles
  const rolePatterns = [
    'software engineer', 'developer', 'manager', 'analyst', 'designer',
    'consultant', 'director', 'lead', 'specialist', 'coordinator', 'architect'
  ];
  let currentRole = "Not detected";
  for (const pattern of rolePatterns) {
    if (textLower.includes(pattern)) {
      const lines = resumeText.split('\n');
      for (const line of lines) {
        if (line.toLowerCase().includes(pattern)) {
          currentRole = line.trim().substring(0, 50);
          break;
        }
      }
      break;
    }
  }
  
  // Estimate years of experience
  const yearMatches = resumeText.match(/(19|20)\d{2}/g);
  let yearsExperience = "Not specified";
  if (yearMatches && yearMatches.length >= 2) {
    const years = yearMatches.map(y => parseInt(y)).sort((a, b) => a - b);
    const minYear = years[0];
    const maxYear = years[years.length - 1];
    const experience = maxYear - minYear;
    if (experience > 0 && experience < 50) {
      yearsExperience = `${experience}+ years`;
    }
  }
  
  // Extract top skills
  const foundSkills: string[] = [];
  [...ATS_KEYWORDS.technical_skills, ...ATS_KEYWORDS.soft_skills].forEach(skill => {
    if (textLower.includes(skill)) {
      foundSkills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
    }
  });
  
  return {
    name,
    currentRole,
    yearsExperience,
    topSkills: foundSkills.slice(0, 5)
  };
}

// Generate suggestions
function generateSuggestions(resumeText: string, jobDescription?: string): {
  additions: string[];
  removals: string[];
  improvements: string[];
} {
  const textLower = resumeText.toLowerCase();
  const additions: string[] = [];
  const removals: string[] = [];
  const improvements: string[] = [];
  
  // Check for missing elements
  if (!textLower.includes('linkedin')) {
    additions.push("Add LinkedIn profile URL for better professional presence");
  }
  
  if (!textLower.includes('summary') && !textLower.includes('objective')) {
    additions.push("Add a professional summary section at the top");
  }
  
  if (!textLower.includes('skills')) {
    additions.push("Add a dedicated skills section with relevant keywords");
  }
  
  // Check for weak phrases to remove
  const weakPhrases = ['responsible for', 'duties included', 'helped with', 'worked on'];
  weakPhrases.forEach(phrase => {
    if (textLower.includes(phrase)) {
      removals.push(`Replace "${phrase}" with stronger action verbs`);
    }
  });
  
  // General improvements
  const hasMetrics = resumeText.match(/\d+%|\$\d+/);
  if (!hasMetrics) {
    improvements.push("Add quantifiable achievements with numbers (%, $, metrics)");
  }
  
  if (!resumeText.match(/[•\-\*]/g) || resumeText.match(/[•\-\*]/g)!.length < 5) {
    improvements.push("Use more bullet points to highlight achievements");
  }
  
  // JD-specific suggestions
  if (jobDescription) {
    const jdLower = jobDescription.toLowerCase();
    const jdTokens = new Set(tokenize(jobDescription));
    const resumeTokens = new Set(tokenize(resumeText));
    
    // Find important keywords in JD not in resume
    const missingKeywords = [...jdTokens].filter(token => 
      !resumeTokens.has(token) && 
      token.length > 4 &&
      !['about', 'their', 'would', 'should', 'could', 'which', 'where', 'there'].includes(token)
    ).slice(0, 5);
    
    if (missingKeywords.length > 0) {
      additions.push(`Add relevant keywords from job description: ${missingKeywords.join(', ')}`);
    }
    
    // Check for role-specific suggestions
    if (jdLower.includes('team') && !textLower.includes('team')) {
      additions.push("Highlight teamwork and collaboration experience");
    }
    
    if (jdLower.includes('leadership') && !textLower.includes('led') && !textLower.includes('managed')) {
      additions.push("Include leadership examples with action verbs like 'led', 'managed', 'directed'");
    }
  }
  
  return {
    additions: additions.slice(0, 5),
    removals: removals.slice(0, 3),
    improvements: improvements.slice(0, 5)
  };
}

// Main analysis function
export function analyzeResumeLocally(resumeText: string, jobDescription?: string | null): AnalysisResult {
  const hasJD = !!jobDescription && jobDescription.trim().length > 0;
  
  // Calculate scores
  const atsResult = calculateATSScore(resumeText);
  const structureResult = calculateStructureScore(resumeText);
  
  let jdMatchScore: number | undefined;
  if (hasJD && jobDescription) {
    jdMatchScore = Math.round(calculateTFIDFSimilarity(resumeText, jobDescription));
  }
  
  // Get sections
  const sections = detectSections(resumeText);
  
  // Get candidate context
  const candidateContext = extractCandidateContext(resumeText);
  
  // Get suggestions
  const suggestions = generateSuggestions(resumeText, jobDescription || undefined);
  
  // Generate key findings
  const keyFindings = {
    strongMatches: candidateContext.topSkills.length > 0 
      ? [`Found ${candidateContext.topSkills.length} relevant skills: ${candidateContext.topSkills.slice(0, 3).join(', ')}`]
      : ["Resume contains relevant content"],
    criticalGaps: [] as string[],
    quickWins: suggestions.improvements.slice(0, 2)
  };
  
  if (atsResult.score < 60) {
    keyFindings.criticalGaps.push("ATS compatibility needs improvement");
  }
  if (!sections.find(s => s.name === "Professional Summary")?.present) {
    keyFindings.criticalGaps.push("Missing professional summary section");
  }
  
  return {
    atsScore: atsResult.score,
    jdMatchScore: hasJD ? jdMatchScore : undefined,
    structureScore: structureResult.score,
    hasJobDescription: hasJD,
    suggestions,
    structureAnalysis: {
      sections: sections.map(s => ({
        name: s.name,
        status: s.quality,
        feedback: s.present ? `${s.name} section found` : `Add ${s.name} section`
      })),
      formatting: structureResult.formatting
    },
    candidateContext,
    keyFindings
  };
}
