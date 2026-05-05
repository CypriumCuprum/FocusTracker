const { GLib, Soup, Shell, Meta, Gio } = imports.gi;

const WS_URI = 'ws://127.0.0.1:8080/';
const RECONNECT_DELAY_MS = 5000;

class FocusTrackerExtension {
    constructor() {
        this._focusSignalId = null;
        this._ws = null;
        this._reconnectId = null;
        this._cancellable = null;
        this._session = new Soup.Session();
    }

    enable() {
        this._connect();
        this._focusSignalId = global.display.connect(
            'notify::focus-window',
            () => this._onFocusChanged()
        );
    }

    disable() {
        if (this._focusSignalId) {
            global.display.disconnect(this._focusSignalId);
            this._focusSignalId = null;
        }
        this._stopReconnect();
        this._closeConnection();
    }

    _connect() {
        this._stopReconnect();
        this._cancellable = new Gio.Cancellable();
        
        let message = Soup.Message.new('GET', WS_URI);

        this._session.websocket_connect_async(
            message, 
            "http://127.0.0.1", 
            null, 
            this._cancellable, 
            (session, res) => {
                try {
                    this._ws = session.websocket_connect_finish(res);
                    this._ws.connect('closed', () => this._scheduleReconnect());
                    this._ws.connect('error', () => this._scheduleReconnect());
                    this._onFocusChanged();
                } catch (e) {
                    this._scheduleReconnect();
                }
            }
        );
    }

    _onFocusChanged() {
        const win = global.display.get_focus_window();
        if (!win) return;

        const tracker = Shell.WindowTracker.get_default();
        const app     = tracker.get_window_app(win);
        const appName = app ? app.get_name() : win.get_wm_class();
        if (!appName) return;

        this._send({ source: 'desktop', app_name: appName });
    }

    _send(payload) {
        if (!this._ws) return;
        try {
            const json = JSON.stringify(payload);
            this._ws.send_text(json);
        } catch (e) {
            this._scheduleReconnect();
        }
    }

    _scheduleReconnect() {
        this._closeConnection();
        this._stopReconnect();
        this._reconnectId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, RECONNECT_DELAY_MS, () => {
            this._reconnectId = null;
            this._connect();
            return GLib.SOURCE_REMOVE;
        });
    }

    _stopReconnect() {
        if (this._reconnectId) {
            GLib.source_remove(this._reconnectId);
            this._reconnectId = null;
        }
    }

    _closeConnection() {
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
        if (this._ws) {
            this._ws.close(Soup.WebsocketCloseCode.NORMAL, null);
            this._ws = null;
        }
    }
}

function init() {
    return new FocusTrackerExtension();
}
