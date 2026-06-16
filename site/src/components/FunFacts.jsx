// Playful "did you know" milestones — the bit Granny will read out to friends.
export default function FunFacts({ facts }) {
  return (
    <div className="funfacts">
      {facts.map((f, i) => (
        <div className="funfact" key={i}>
          <div className="funfact-emoji" aria-hidden="true">{f.emoji}</div>
          <div className="funfact-headline">{f.headline}</div>
          <div className="funfact-text">{f.text}</div>
        </div>
      ))}
    </div>
  );
}
