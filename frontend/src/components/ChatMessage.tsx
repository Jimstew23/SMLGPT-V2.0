import React from 'react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  isLast?: boolean;
  onSpeakMessage?: (text: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLast = false }) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  if (isUser) {
    return (
      <div className="message user">
        <div className="bubble">{message.content}</div>
        <div className="timestamp">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    );
  }

  if (isAssistant) {
    return (
      <div className="message ai">
        <img src="/SML.png" alt="SML logo" className="ai-small-logo"/>
        <div>
          <div className="bubble">{message.content}</div>
          <div className="timestamp">
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default ChatMessage;
