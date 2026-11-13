// Native bridges (Capacitor on iOS/Android). Everything feature-detected; the web build never breaks.
let Haptics = null, Capacitor = null;
export async function initNative() {
  try {
    const cap = await import('@capacitor/core'); Capacitor = cap.Capacitor;
    if (!Capacitor.isNativePlatform()) return;
    if (Capacitor.isPluginAvailable('Haptics')) Haptics = (await import('@capacitor/haptics')).Haptics;
    if (Capacitor.isPluginAvailable('StatusBar')) { const { StatusBar, Style } = await import('@capacitor/status-bar'); await StatusBar.setStyle({ style: Style.Dark }).catch(() => {}); await StatusBar.hide().catch(() => {}); }
    try { await screen.orientation?.lock?.('portrait'); } catch {}
  } catch {}
}
export const haptic = {
  light() { Haptics?.impact({ style: 'LIGHT' }).catch(() => {}); },
  medium() { Haptics?.impact({ style: 'MEDIUM' }).catch(() => {}); },
  heavy() { Haptics?.impact({ style: 'HEAVY' }).catch(() => {}); },
  success() { Haptics?.notification({ type: 'SUCCESS' }).catch(() => {}); },
  error() { Haptics?.notification({ type: 'ERROR' }).catch(() => {}); },
};
