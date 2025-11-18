import { isValidEmail } from './validation';

export const parseLinkedInData = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const parsed = {
    personalInfo: { 
      fullName: '', email: '', phone: '', location: '', 
      linkedIn: '', github: '', twitter: '', instagram: '', website: '', summary: '' 
    },
    education: [],
    experience: [],
    skills: [],
    projects: [],
    confidence: 0
  };

  let currentSection = null;
  let currentItem = null;
  let fieldsFound = 0;

  lines.forEach((line, index) => {
    const lowerLine = line.toLowerCase();
    
    if (index === 0 && line.length < 50 && !line.includes('@') && !lowerLine.includes('resume')) {
      parsed.personalInfo.fullName = line;
      fieldsFound++;
    }
    
    const emailMatch = line.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch && isValidEmail(emailMatch[0])) {
      parsed.personalInfo.email = emailMatch[0];
      fieldsFound++;
    }
    
    const phoneMatch = line.match(/\+?\d[\d\s()-]{8,}/);
    if (phoneMatch) {
      parsed.personalInfo.phone = phoneMatch[0];
      fieldsFound++;
    }
    
    if (line.includes('linkedin.com')) {
      parsed.personalInfo.linkedIn = line;
      fieldsFound++;
    } else if (line.includes('github.com')) {
      parsed.personalInfo.github = line;
      fieldsFound++;
    } else if (line.includes('twitter.com')) {
      parsed.personalInfo.twitter = line;
    }
    
    if (lowerLine.includes('summary') || lowerLine.includes('about') || lowerLine.includes('profile')) {
      currentSection = 'summary';
    } else if (lowerLine.includes('experience') || lowerLine.includes('work history')) {
      currentSection = 'experience';
      if (currentItem) parsed.experience.push(currentItem);
      currentItem = null;
    } else if (lowerLine.includes('education')) {
      currentSection = 'education';
      if (currentItem) parsed.education.push(currentItem);
      currentItem = null;
    } else if (lowerLine.includes('skills') || lowerLine.includes('technical')) {
      currentSection = 'skills';
    } else if (lowerLine.includes('projects')) {
      currentSection = 'projects';
    } else if (currentSection === 'summary' && line.length > 50 && !line.match(/\d{4}/)) {
      parsed.personalInfo.summary += line + ' ';
    } else if (currentSection === 'experience') {
      if (line.match(/\d{4}/) && (line.includes('-') || line.includes('to') || lowerLine.includes('present'))) {
        if (currentItem) parsed.experience.push(currentItem);
        currentItem = { position: '', company: '', startDate: '', endDate: '', description: '' };
        const dates = line.match(/(\w+\s+\d{4})\s*[-–to]\s*(\w+\s+\d{4}|Present)/i);
        if (dates) {
          currentItem.startDate = dates[1];
          currentItem.endDate = dates[2];
          fieldsFound++;
        }
      } else if (currentItem && !currentItem.position && line.length > 5) {
        currentItem.position = line;
      } else if (currentItem && !currentItem.company && line.length > 3) {
        currentItem.company = line;
      } else if (currentItem) {
        currentItem.description += line + ' ';
      }
    } else if (currentSection === 'education') {
      if (line.match(/\d{4}/)) {
        if (currentItem) parsed.education.push(currentItem);
        currentItem = { degree: '', institution: '', year: '', gpa: '' };
        currentItem.year = line.match(/\d{4}(-\d{4})?/)?.[0] || '';
        fieldsFound++;
      } else if (currentItem && !currentItem.degree) {
        currentItem.degree = line;
      } else if (currentItem && !currentItem.institution) {
        currentItem.institution = line;
      } else if (currentItem && (line.match(/GPA|gpa/i) || line.match(/\d\.\d/))) {
        currentItem.gpa = line.match(/[\d.]+/)?.[0] || '';
      }
    } else if (currentSection === 'skills') {
      const skillDelimiters = /[,•·|;]/g;
      const skills = line.split(skillDelimiters)
        .map(s => s.trim())
        .filter(s => s && s.length > 1 && s.length < 30 && !s.match(/^\d+$/));
      if (skills.length > 0) {
        parsed.skills.push(...skills);
        fieldsFound += skills.length;
      }
    } else if (currentSection === 'projects') {
      if (!currentItem || currentItem.name) {
        if (currentItem) parsed.projects.push(currentItem);
        currentItem = { name: line, description: '', link: '', technologies: '' };
      } else {
        currentItem.description += line + ' ';
      }
    }
  });

  if (currentItem && currentSection === 'experience') parsed.experience.push(currentItem);
  if (currentItem && currentSection === 'education') parsed.education.push(currentItem);
  if (currentItem && currentSection === 'projects') parsed.projects.push(currentItem);

  const maxFields = 20;
  parsed.confidence = Math.min(Math.round((fieldsFound / maxFields) * 100), 100);

  return parsed;
};