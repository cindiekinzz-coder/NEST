import { useReducer, useCallback, useMemo } from 'react';
import { UIStateContext, reducer, initialState } from './contexts/UIStateContext.jsx';
import { StreamingContext } from './contexts/StreamingContext.jsx';
import { useWebSocketStream } from './hooks/useWebSocketStream.js';
import { DefaultAppLayout } from './components/DefaultAppLayout.jsx';
import { StreamingState } from './types.js';

export function App({ config }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const { send } = useWebSocketStream({
    url: config.gatewayUrl,
    model: config.model,
    workspace: config.workspace,
    dispatch,
  });

  const submit = useCallback((text) => {
    dispatch({ type: 'append', item: { kind: 'user', content: text, timestamp: nowTs() } });
    dispatch({ type: 'streaming', value: StreamingState.Responding });
    send({ type: 'chat', content: text, model: config.model, plan_mode: config.planMode ?? false });
  }, [send, config.model, config.planMode]);

  const stop = useCallback(() => {
    if (state.streamingState === StreamingState.Responding) send({ type: 'stop' });
  }, [send, state.streamingState]);

  const ctxValue = useMemo(() => ({ state, dispatch, submit, stop }), [state, submit, stop]);

  return (
    <UIStateContext.Provider value={ctxValue}>
      <StreamingContext.Provider value={state.streamingState}>
        <DefaultAppLayout model={config.model} />
      </StreamingContext.Provider>
    </UIStateContext.Provider>
  );
}

const nowTs = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
