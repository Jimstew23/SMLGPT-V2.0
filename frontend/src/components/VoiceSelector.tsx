import React, { useState, useEffect } from 'react';
import { Volume2, ChevronDown } from 'lucide-react';

interface Voice {
  name: string;
  voiceURI: string;
  lang: string;
  localService: boolean;
}

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voiceURI: string) => void;
  className?: string;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedVoice,
  onVoiceChange,
  className = ''
}) => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices().map(voice => ({
        name: voice.name,
        voiceURI: voice.voiceURI,
        lang: voice.lang,
        localService: voice.localService
      }));
      
      // Enhanced voice filtering - prioritize high-quality voices
      const englishVoices = availableVoices.filter(voice => 
        voice.lang.startsWith('en-') || voice.lang === 'en'
      );

      // Sort voices by quality preference (premium/neural voices first)
      const sortedVoices = englishVoices.sort((a, b) => {
        // Prioritize premium/neural voices
        const aIsPremium = a.name.toLowerCase().includes('neural') || 
                          a.name.toLowerCase().includes('premium') ||
                          a.name.toLowerCase().includes('enhanced') ||
                          a.name.toLowerCase().includes('natural');
        const bIsPremium = b.name.toLowerCase().includes('neural') || 
                          b.name.toLowerCase().includes('premium') ||
                          b.name.toLowerCase().includes('enhanced') ||
                          b.name.toLowerCase().includes('natural');
        
        if (aIsPremium && !bIsPremium) return -1;
        if (!aIsPremium && bIsPremium) return 1;
        
        // Then prioritize local voices for better performance
        if (a.localService && !b.localService) return -1;
        if (!a.localService && b.localService) return 1;
        
        // Finally sort alphabetically
        return a.name.localeCompare(b.name);
      });
      
      setVoices(sortedVoices.length > 0 ? sortedVoices : availableVoices);
    };

    // Load voices immediately
    loadVoices();
    
    // Load voices when they become available (some browsers load async)
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  const currentVoice = voices.find(voice => voice.voiceURI === selectedVoice) || voices[0];

  const handleVoiceSelect = (voiceURI: string) => {
    onVoiceChange(voiceURI);
    setIsOpen(false);
  };

  const testVoice = (voiceURI: string) => {
    const voice = voices.find(v => v.voiceURI === voiceURI);
    if (voice && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('Hello! This is how I sound.');
      const synthVoice = speechSynthesis.getVoices().find(v => v.voiceURI === voiceURI);
      if (synthVoice) {
        utterance.voice = synthVoice;
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        speechSynthesis.speak(utterance);
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 text-sm text-white transition-colors"
      >
        <Volume2 size={16} />
        <span className="truncate max-w-32">
          {currentVoice?.name || 'Select Voice'}
        </span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          <div className="p-2 border-b border-gray-600">
            <div className="text-xs text-gray-400 mb-1">Available Voices</div>
          </div>
          
          {voices.map((voice) => (
            <div
              key={voice.voiceURI}
              className={`p-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-b-0 ${
                voice.voiceURI === selectedVoice ? 'bg-sml-blue-500/20' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex-1"
                  onClick={() => handleVoiceSelect(voice.voiceURI)}
                >
                  <div className="text-sm text-white font-medium">
                    {voice.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {voice.lang} • {voice.localService ? 'Local' : 'Cloud'}
                  </div>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    testVoice(voice.voiceURI);
                  }}
                  className="ml-2 px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded transition-colors"
                >
                  Test
                </button>
              </div>
            </div>
          ))}

          {voices.length === 0 && (
            <div className="p-4 text-center text-gray-400 text-sm">
              No voices available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceSelector;
