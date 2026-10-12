import { useParams } from 'react-router-dom';

export default function RepoDetail() {
  const { repoId } = useParams();
  return (
    <div>
      <h1>Repo Detail</h1>
      <p>Repo ID: {repoId}</p>
      <p>Placeholder — to be built from Figma design.</p>
    </div>
  );
}
