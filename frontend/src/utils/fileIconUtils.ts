// Centralized file icon styling utility - eliminates duplicate getFileIconStyle functions
export interface FileIconStyle {
  icon: string;
  color: string;
  bgColor: string;
}

export const getFileIconStyle = (file: File): FileIconStyle => {
  // Log file info for debugging
  console.log('Centralized file type detection:', {
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified
  });

  // Image files
  if (file.type.startsWith('image/')) {
    return { icon: '🖼️', color: '#666', bgColor: '#f0f0f0' };
  }
  
  // PDF files
  if (file.type === 'application/pdf') {
    return { icon: '📄', color: '#ffffff', bgColor: '#ff6b6b' }; // Light red
  }
  
  // PowerPoint files - enhanced detection
  if (file.type.includes('presentation') || 
      file.type.includes('powerpoint') ||
      file.type === 'application/vnd.ms-powerpoint' ||
      file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      file.name.toLowerCase().endsWith('.ppt') ||
      file.name.toLowerCase().endsWith('.pptx')) {
    return { icon: '📄', color: '#ffffff', bgColor: '#c41e3a' }; // Dark red
  }
  
  // Word documents - enhanced detection
  if (file.type.includes('document') || 
      file.type.includes('word') ||
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.toLowerCase().endsWith('.doc') ||
      file.name.toLowerCase().endsWith('.docx')) {
    return { icon: '📄', color: '#ffffff', bgColor: '#4285f4' }; // Blue
  }
  
  // Excel files - enhanced detection
  if (file.type.includes('sheet') || 
      file.type.includes('excel') ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.name.toLowerCase().endsWith('.xls') ||
      file.name.toLowerCase().endsWith('.xlsx')) {
    return { icon: '📄', color: '#ffffff', bgColor: '#34a853' }; // Green
  }
  
  // Text files
  if (file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt')) {
    return { icon: '📄', color: '#666', bgColor: '#f0f0f0' };
  }
  
  // Default for unknown files
  return { icon: '📄', color: '#666', bgColor: '#f0f0f0' };
};

// Helper function to create image preview URL
export const createImagePreview = (file: File): string | undefined => {
  if (file.type.startsWith('image/')) {
    return URL.createObjectURL(file);
  }
  return undefined;
};
