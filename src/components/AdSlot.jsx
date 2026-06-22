export function AdSlot({ compact = false, label, name, slots = null }) {
  const configuredSlot = Array.isArray(slots)
    ? slots.find((slot) => slot.slot_key === name)
    : null;

  if (Array.isArray(slots) && (!configuredSlot || configuredSlot.enabled === false)) {
    return null;
  }

  return (
    <aside className={`adSlot ${compact ? 'sideAd' : ''}`} data-ad-slot={name} aria-label={label}>
      <span>{label}</span>
      <small>{configuredSlot?.format || 'Advertisement space'} · Policy-safe reserved inventory</small>
    </aside>
  );
}
