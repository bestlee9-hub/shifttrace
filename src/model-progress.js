// Chrome supplies normalized progress for the SDK download callback.
export function modelProgress(fraction) {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) return null;
  return fraction === 1 ? 100 : Math.min(99, Math.floor((fraction + Number.EPSILON) * 100));
}

export function preparationView({phase, percent}) {
  const full = percent === 100 ? 'Download complete (100%). ' : '';
  const msg = {
    idle: 'Prepare the Chrome model first, or analyze now with cloud fallback if needed.',
    checking: 'Checking on-device model…',
    downloading: percent === null ? 'Downloading model… Chrome has not reported a percentage.' : 'Downloading model · '+percent+'%',
    preparing: 'Download complete (100%) · preparing model…',
    ready: full+'On-device model ready.',
    unavailable: full+'On-device model is unavailable on this browser.',
    'not-ready': full+'On-device model is not ready yet. Check again before testing locally.',
    unknown: full+'Chrome did not report whether the on-device model is ready.',
    error: full+'On-device model preparation failed. Try again or analyze with hybrid fallback.'
  };
  return {
    label:msg[phase],
    kind:phase==='ready'?'ok':phase==='error'?'error':'info',
    busy:['checking','downloading','preparing'].includes(phase),
    value:phase==='downloading'?percent:null
  };
}

export function createDevicePreparation(checkAvailability, initialize) {
  let state = { phase: 'idle', percent: null };
  let pending;
  const listeners = new Set();
  const update = (phase, percent = state.percent) => {
    state = { phase, percent };
    for (const listener of listeners) listener(state);
  };
  return {
    observe(listener) { listeners.add(listener); listener(state); },
    start() {
      if (pending) return pending;
      if (state.phase === 'ready') return Promise.resolve();
      update('checking', null);
      const progress = fraction => {
        if (!['checking', 'downloading', 'preparing'].includes(state.phase)) return;
        const percent = modelProgress(fraction);
        if (percent === null || (state.percent !== null && percent <= state.percent)) return;
        update(percent === 100 ? 'preparing' : 'downloading', percent);
      };
      // Invoke initialization in the click's call stack; Chrome may require user activation.
      let setup;
      try { setup = initialize(progress); }
      catch (err) { setup = Promise.reject(err); }
      const initial = Promise.resolve().then(checkAvailability).then(value => {
        if (state.phase === 'checking' && (value === 'downloadable' || value === 'downloading')) {
          update('downloading');
        }
      }).catch(() => {});
      pending = Promise.resolve(setup)
        .then(async () => {
          await initial;
          const available = await checkAvailability();
          if (available === 'available') update('ready');
          else if (available === 'unavailable') update('unavailable');
          else if (available === 'downloadable' || available === 'downloading') update('not-ready');
          else update('unknown');
        })
        .catch(() => update('error'))
        .finally(() => { pending = undefined; });
      return pending;
    }
  };
}
