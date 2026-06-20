export function AdSlot({ compact = false, label, name }) {
  return (
    <div className={`adSlot ${compact ? 'sideAd' : ''}`} data-ad-slot={name}>
      <span>{label}</span>
      <small>Advertisement space</small>
    </div>
  );
}
