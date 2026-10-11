import { useState } from "react";
import type { SyncStatus } from "../settingsSync";
import type { Key } from "../i18n";

type Props = {
  L: (key: Key, params?: Record<string, string>) => string;
  code: string | null;
  status: SyncStatus;
  turnOn: () => void;
  joinWithCode: (text: string) => boolean;
  turnOff: () => void;
};

const STATUS_KEY: Record<Exclude<SyncStatus, "off">, Key> = { syncing: "syncSyncing", synced: "syncSynced", offline: "syncOffline", error: "syncError" };

/** Settings panel for end-to-end encrypted sync of favourites, unit and theme. */
export default function SyncPanel({ L, code, status, turnOn, joinWithCode, turnOff }: Props) {
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);
  return (
    <details className="sync-panel">
      <summary>{L("syncTitle")}</summary>
      {code ? (
        <>
          <label>{L("syncCodeLabel")}<input readOnly value={code} onFocus={(e) => e.currentTarget.select()} /></label>
          {status !== "off" && <p role="status">{L("syncStatus", { status: L(STATUS_KEY[status]) })}</p>}
          <button type="button" className="glass-btn" onClick={turnOff}>{L("syncOff")}</button>
        </>
      ) : (
        <>
          <button type="button" className="glass-btn" onClick={turnOn}>{L("syncOn")}</button>
          <form onSubmit={(e) => { e.preventDefault(); setBad(!joinWithCode(text)); }}>
            <label>{L("syncJoinLabel")}<input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" spellCheck={false} /></label>
            <button type="submit" className="glass-btn">{L("syncJoin")}</button>
            {bad && <p role="alert">{L("syncBad")}</p>}
          </form>
        </>
      )}
    </details>
  );
}
