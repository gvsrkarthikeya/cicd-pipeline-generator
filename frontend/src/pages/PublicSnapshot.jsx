import { useParams } from 'react-router-dom';

export default function PublicSnapshot() {
  const { shareId } = useParams();
  return (
    <div>
      <h1>Shared Pipeline Snapshot</h1>
      <p>Share ID: {shareId}</p>
      <p>Placeholder — to be built from Figma design.</p>
    </div>
  );
}
