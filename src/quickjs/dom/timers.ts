import { QuickJSAsyncContext } from 'quickjs-emscripten';
import { getFunctionFactory } from './document';

type TimerDisposeFunction = () => void;

export const createTimers = (context: QuickJSAsyncContext) => {
  const createGlobalFn = getFunctionFactory(context);

  const timeouts = new Map<number, TimerDisposeFunction>();
  const intervals = new Map<number, TimerDisposeFunction>();

  createGlobalFn('clearTimeout', (hTimeoutId) => timeouts.get(context.getNumber(hTimeoutId))?.());
  createGlobalFn('clearInterval', (hIntervalId) => intervals.get(context.getNumber(hIntervalId))?.());

  createGlobalFn('setTimeout', (fnHandle, hTimeout) => {
    const duped = fnHandle.dup();
    const id = setTimeout(() => {
      try {
        context.unwrapResult(context.callFunction(duped, context.undefined)).dispose();
        duped.dispose();
      } finally {
        queueMicrotask(() => context.runtime.executePendingJobs());
      }
    }, context.getNumber(hTimeout));

    timeouts.set(Number(id), () => {
      clearTimeout(id);
      if (duped.alive) {
        duped.dispose();
      }
    });
  });

  createGlobalFn('setInterval', (fnHandle, hInterval) => {
    const duped = fnHandle.dup();
    const id = setInterval(() => {
      try {
        context.unwrapResult(context.callFunction(duped.dup(), context.undefined)).dispose();
      } finally {
        queueMicrotask(() => context.runtime.executePendingJobs());
      }
    }, context.getNumber(hInterval));

    intervals.set(Number(id), () => {
      clearInterval(id);
      if (duped.alive) {
        duped.dispose();
      }
    });
  });

  return () => {
    [...intervals.values()].map((dispose) => dispose());
    [...timeouts.values()].map((dispose) => dispose());
  };
};
