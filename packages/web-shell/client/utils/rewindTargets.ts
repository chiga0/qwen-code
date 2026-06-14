import type { DaemonRewindSnapshotInfo } from '@qwen-code/webui/daemon-react-sdk';
import type { RewindTarget } from '../components/dialogs/RewindDialog';

export function buildRewindTargets(
  snapshots: readonly DaemonRewindSnapshotInfo[],
): RewindTarget[] {
  return [...snapshots]
    .sort((a, b) => a.turnIndex - b.turnIndex)
    .flatMap((snapshot) => {
      const text = snapshot.text.trim();
      return text ? [{ ...snapshot, text }] : [];
    });
}
