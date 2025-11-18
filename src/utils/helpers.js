export const getRelativeTime = (date) => {
  if (!date) return '';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export const duplicateResumeData = (resumeData) => {
  return {
    ...resumeData,
    personalInfo: {
      ...resumeData.personalInfo,
      fullName: `${resumeData.personalInfo.fullName} (Copy)`
    },
    education: resumeData.education.map(edu => ({ ...edu })),
    experience: resumeData.experience.map(exp => ({ ...exp })),
    skills: [...resumeData.skills],
    projects: resumeData.projects.map(proj => ({ ...proj }))
  };
};

export const getTemplateClasses = (color, isSelected) => {
  const colorMap = {
    blue: 'border-blue-500 bg-blue-50',
    gray: 'border-gray-500 bg-gray-50',
    purple: 'border-purple-500 bg-purple-50',
    indigo: 'border-indigo-500 bg-indigo-50',
    slate: 'border-slate-500 bg-slate-50',
    green: 'border-green-500 bg-green-50',
    amber: 'border-amber-500 bg-amber-50',
    teal: 'border-teal-500 bg-teal-50',
    pink: 'border-pink-500 bg-pink-50',
    emerald: 'border-emerald-500 bg-emerald-50',
  };
  
  return isSelected 
    ? `${colorMap[color]} shadow-lg` 
    : 'border-gray-200 hover:border-gray-300';
};