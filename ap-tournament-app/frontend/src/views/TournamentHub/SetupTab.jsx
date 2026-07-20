import { useOutletContext } from 'react-router-dom';
import SetupTabContent from './SetupTabContent';

/** Used inside Tournament Hub (existing tournament) */
export default function SetupTab() {
  const ctx = useOutletContext();
  return <SetupTabContent isNew={false} tournament={ctx?.tournament} refresh={ctx?.refresh} />;
}

/** Used at /tournament/new - avoids useOutletContext on standalone route */
export function CreateTournamentPage() {
  return <SetupTabContent isNew tournament={null} refresh={() => {}} />;
}
