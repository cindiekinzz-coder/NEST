import { createContext, useContext } from 'react';
import { StreamingState, newId } from '../types.js';

export const initialState = {
  history: [],
  streamingState: StreamingState.Idle,
  status: 'connecting',
  workspace: null,
  todos: [],
  fox: null,
};

export function reducer(state, action) {
  switch (action.type) {
    case 'append':
      return { ...state, history: [...state.history, { id: newId(), ...action.item }] };
    case 'merge_last_tool': {
      const idx = [...state.history].reverse().findIndex(
        (h) => h.kind === 'tool_call' && h.name === action.item.name && h.result === undefined,
      );
      if (idx === -1) {
        return { ...state, history: [...state.history, { id: newId(), ...action.item }] };
      }
      const realIdx = state.history.length - 1 - idx;
      const merged = [...state.history];
      merged[realIdx] = { ...merged[realIdx], result: action.item.result, resultAt: action.item.timestamp };
      return { ...state, history: merged };
    }
    case 'streaming':
      return { ...state, streamingState: action.value };
    case 'status':
      return { ...state, status: action.value };
    case 'workspace':
      return { ...state, workspace: action.value };
    case 'todos':
      return { ...state, todos: action.items };
    case 'fox':
      return { ...state, fox: action.value };
    default:
      return state;
  }
}

export const UIStateContext = createContext(null);

export function useUIState() {
  const ctx = useContext(UIStateContext);
  if (!ctx) throw new Error('useUIState requires <UIStateContext.Provider>');
  return ctx;
}
