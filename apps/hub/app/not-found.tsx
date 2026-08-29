import Link from "next/link";

export default function NotFound() {
  return (
    <main className="launch-state">
      <p className="marketing-eyebrow">A wrong turn</p>
      <h1>This stop is not on tonight’s route.</h1>
      <p>Return home or open the Shibuya planner.</p>
      <div>
        <Link className="marketing-primary" href="/">
          Back home
        </Link>
        <Link className="marketing-secondary" href="/plan">
          Open planner
        </Link>
      </div>
    </main>
  );
}
