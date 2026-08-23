/**
 * Animated aurora background — three slowly drifting colour blobs behind
 * all content. A web translation of the "background loop" motion-graphics
 * style (Motion Array). Sits at z-index 0, never intercepts clicks, and is
 * kept faint so text stays readable.
 */
export default function AmbientBackground() {
  return (
    <div className="aurora" aria-hidden="true">
      <span className="a1" />
      <span className="a2" />
      <span className="a3" />
    </div>
  );
}
