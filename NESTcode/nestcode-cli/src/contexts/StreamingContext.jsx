import { createContext, useContext } from 'react';
import { StreamingState } from '../types.js';

export const StreamingContext = createContext(StreamingState.Idle);
export const useStreaming = () => useContext(StreamingContext);
