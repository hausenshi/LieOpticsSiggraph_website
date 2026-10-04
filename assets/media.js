/* Muted, inline video playback shared by every section that shows video.
 * Keeps playback intent separate from a browser's autoplay permission, and retries
 * after the next user gesture when autoplay is blocked (including in WeChat).
 */
window.paperMedia = (() => {
  const pending = new WeakSet();
  const configured = new WeakSet();
  function configure(video) {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    for (const name of ['muted', 'playsinline', 'webkit-playsinline', 'x5-playsinline']) video.setAttribute(name, '');
    if (!configured.has(video)) {
      configured.add(video);
      video.addEventListener('playing', () => {
        delete video.dataset.playBlocked;
        video.controls = false;
      });
    }
  }
  function play(video, wanted = () => video.isConnected && !document.hidden) {
    configure(video);
    if (!wanted() || !video.paused || pending.has(video)) return;
    pending.add(video);
    function attempt(bridgeAllowed) {
      if (!wanted()) { pending.delete(video); return; }
      let promise;
      try { promise = video.play(); } catch (error) { failed(error, bridgeAllowed); return; }
      Promise.resolve(promise).then(() => {
        pending.delete(video);
        if (!wanted()) video.pause();
        else { delete video.dataset.playBlocked; video.controls = false; }
      }).catch(error => failed(error, bridgeAllowed));
    }
    function failed(error, bridgeAllowed) {
      pending.delete(video);
      if (!wanted() || error.name !== 'NotAllowedError') return;
      video.dataset.playBlocked = 'true';
      video.controls = true;
      if (bridgeAllowed && window.WeixinJSBridge?.invoke) {
        try {
          window.WeixinJSBridge.invoke('getNetworkType', {}, () => {
            if (!wanted() || !video.paused || pending.has(video)) return;
            pending.add(video);
            attempt(false);
          });
        } catch (_) { /* Native controls remain available if the bridge rejects the call. */ }
      }
    }
    attempt(true);
  }
  const retry = () => document.dispatchEvent(new Event('paper-media-activation'));
  for (const name of ['touchend', 'click', 'keydown', 'WeixinJSBridgeReady']) document.addEventListener(name, retry);
  window.addEventListener('pageshow', retry);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) retry(); });
  return {configure, play};
})();
