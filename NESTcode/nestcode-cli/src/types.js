export const StreamingState = Object.freeze({
  Idle: 'idle',
  Responding: 'responding',
  WaitingForConfirmation: 'waiting_for_confirmation',
});

let nextId = 1;
export const newId = () => nextId++;
