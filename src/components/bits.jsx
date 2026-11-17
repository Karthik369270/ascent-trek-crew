import { useEffect } from 'react';
import Icon from './Icon.jsx';
import { initials } from '../lib/format.js';

export function Avatar({ person, size = 36, ring }) {
  return (
    <span className={`avatar${ring ? ' ring' : ''}`} style={{ width: size, height: size, background: person?.color || 'var(--card-2)', fontSize: size * 0.38 }} title={person?.name}>
      {initials(person?.name)}
    </span>
  );
}

export function AvatarStack({ people, size = 28, max = 5 }) {
  const shown = people.slice(0, max);
  return (
    <span className="avatar-stack">
      {shown.map((p) => <Avatar key={p.id} person={p} size={size} />)}
      {people.length > max && <span className="avatar more" style={{ width: size, height: size }}>+{people.length - max}</span>}
    </span>
  );
}

export function Pill({ children, tone = 'plain', icon, onClick, className = '' }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag className={`pill pill-${tone} ${className}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      {icon && <Icon name={icon} size={14} />}
      <span className="pill-text">{children}</span>
    </Tag>
  );
}

export function Segmented({ options, value, onChange, small }) {
  return (
    <div className={`segmented${small ? ' small' : ''}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={15} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ pct, tone = 'ink' }) {
  return (
    <div className={`progress progress-${tone}`}>
      <span style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }} />
    </div>
  );
}

export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ icon = 'sparkle', title, children }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function CardHead({ title, sub, right }) {
  return (
    <div className="card-head">
      <div>
        <h3>{title}</h3>
        {sub && <p className="muted small">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
