import React from 'react';

interface UploadedFile {
  filename: string;
  type: string;
  previewUrl?: string;
  blobUrl?: string;
  size?: number;
}

interface SystemMessageWithThumbnailProps {
  file: UploadedFile;
}

const SystemMessageWithThumbnail: React.FC<SystemMessageWithThumbnailProps> = ({ file }) => {
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📽️';
    if (fileType.includes('text')) return '📃';
    return '📎';
  };

  return (
    <div className="chat-bubble system bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-4 mb-4 shadow-sm">
      
      {/* Message Line */}
      <div className="flex items-start space-x-3">
        <span className="text-green-500 text-2xl mt-0.5">✅</span>
        <div className="text-sm text-gray-700 flex-1">
          <p className="font-medium text-gray-800">
            Your file <strong className="text-blue-600">{file.filename}</strong> is uploaded and ready.
          </p>
          <p className="text-gray-600 mt-1">
            What would you like me to do with it?
          </p>
        </div>
      </div>

      {/* Thumbnail Preview */}
      <div className="mt-4 ml-9">
        {file.type.startsWith("image/") ? (
          // Image preview with rounded corners and shadow
          <div className="relative inline-block">
            <img
              src={file.previewUrl}
              alt={file.filename}
              className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200 shadow-md hover:shadow-lg transition-shadow"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 rounded-b-lg">
              {formatFileSize(file.size)}
            </div>
          </div>
        ) : (
          // Document-style preview with icon and metadata
          <div className="flex items-center space-x-3 border-2 border-gray-200 rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition-shadow w-max">
            <div className="text-3xl">{getFileIcon(file.type)}</div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-800 max-w-48 truncate">
                {file.filename}
              </span>
              <span className="text-xs text-gray-500">
                {formatFileSize(file.size)} • {file.type.split('/')[1]?.toUpperCase() || 'FILE'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemMessageWithThumbnail;
