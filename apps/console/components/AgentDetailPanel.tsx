/**
 * @deprecated Superseded by the inline expansion in `AgentRack.tsx`.
 *
 * This was a full-screen modal drawer opened by clicking an agent card. It is
 * gone because the modal was the reason the rack could not read as one
 * instrument: opening an agent covered the page, so you lost your place in the
 * list and had to dismiss before comparing two agents. The same content now
 * expands in place inside the row.
 *
 * The file is reduced to a stub rather than removed because it must stop
 * importing `TIER` and `RackEntry` — both deleted from `agent-rack-data.ts` —
 * or the console will not typecheck. Delete it for real with:
 *
 *     git rm apps/console/components/AgentDetailPanel.tsx
 *
 * Nothing imports it as of this commit.
 */
export default function AgentDetailPanel() {
  return null;
}
