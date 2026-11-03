export const MAX_PIXEL_RATIO = 2;
export const TARGET_FPS = 30;
export const FRAME_MS = 1000 / TARGET_FPS;

export function nextFrameDecision(input: {
  hidden: boolean;
  elapsedMs: number;
  dirty: boolean;
  animating: boolean;
}): { render: boolean; continueLoop: boolean } {
  if (input.hidden) return { render: false, continueLoop: false };
  if (input.elapsedMs < FRAME_MS) return { render: false, continueLoop: true };
  return {
    render: input.dirty || input.animating,
    continueLoop: input.animating,
  };
}
