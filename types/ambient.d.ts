// Ambient type surface for the GJS runtime. Side-effect imports pull the `gi://*`
// module declarations (not re-exported by @girs/gnome-shell/ambient) and the GJS
// globals; @girs/gjs/dom adds `console` and the Text en/decoder; gnome-shell/ambient
// adds the `resource:///...` modules and extensions/global declares `global`.
import '@girs/glib-2.0/ambient';
import '@girs/gobject-2.0/ambient';
import '@girs/gio-2.0/ambient';
import '@girs/clutter-18/ambient';
import '@girs/meta-18/ambient';
import '@girs/st-18/ambient';
import '@girs/gdk-4.0/ambient';
import '@girs/gtk-4.0/ambient';
import '@girs/adw-1/ambient';
import '@girs/pango-1.0/ambient';
import '@girs/gjs/ambient';
import '@girs/gjs/dom';
import '@girs/gnome-shell/ambient';
import '@girs/gnome-shell/misc/ibusManager/ambient';
import '@girs/gnome-shell/extensions/global';

// GI declares get_compositor_private() as a bare GObject; in mutter the compositor
// private of a window is always its Clutter actor.
declare module '@girs/meta-18/meta-18' {
    namespace Meta {
        interface Window {
            get_compositor_private(): import('@girs/clutter-18/clutter-18').Clutter.Actor | null;
        }
    }
}

// @girs ships the keyboard status module but leaves getInputSourceManager and
// InputSourceManager undeclared; augment it with the minimal surface language.js needs.
declare module 'resource:///org/gnome/shell/ui/status/keyboard.js' {
    export const INPUT_SOURCE_TYPE_IBUS: string;
    export class InputSourceManager {
        readonly currentSource: { readonly xkbId: string; readonly type: string } | null;
        connect(signal: string, callback: (...args: unknown[]) => void): number;
        disconnect(id: number): void;
    }
    export function getInputSourceManager(): InputSourceManager;
}
