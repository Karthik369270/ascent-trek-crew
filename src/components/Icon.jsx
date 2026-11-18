const fill = { fill: 'currentColor', stroke: 'none' };

const paths = {
  home: <><path d="M3.5 10.5 12 3.5l8.5 7" /><path d="M5.5 9v11h13V9" /><path d="M10 20v-5.5h4V20" /></>,
  feed: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8 9h8M8 13h8M8 17h4.5" /></>,
  crew: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="8.5" r="2.5" /><path d="M16.5 14c2.7.4 4.5 2.8 4.5 6" /></>,
  plan: <><rect x="3.5" y="5" width="17" height="15" rx="3.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></>,
  play: <path d="M8 5.2v13.6c0 .8.9 1.3 1.6.8l10-6.8a1 1 0 0 0 0-1.6l-10-6.8C8.9 3.9 8 4.4 8 5.2z" {...fill} />,
  pause: <><rect x="6" y="5" width="4" height="14" rx="1.4" {...fill} /><rect x="14" y="5" width="4" height="14" rx="1.4" {...fill} /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="3" {...fill} />,
  mountain: <><path d="M2.5 20 9 8.5l4 6.5 3-4 5.5 9z" /><path d="m7.4 11.4 1.6 1.1 1.6-1.2" /></>,
  flame: <path d="M12 3c.8 3.4 5 5.4 5 10a5 5 0 0 1-10 0c0-2.4 1.2-3.9 2.5-5 .3 1.6 1 2.6 2 3 0-3 0-5 .5-8z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  system: <><rect x="3" y="4.5" width="18" height="12" rx="2.5" /><path d="M9 20h6M12 16.5V20" /></>,
  share: <><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8" /><path d="M5 13v5.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V13" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" />,
  heartFill: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" {...fill} />,
  comment: <path d="M4.5 5.5h15v10.5H10l-5.5 4z" />,
  bike: <><circle cx="6" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" /><path d="M6 16l3.5-7h6L18 16M9.5 9 12 16h-1M14 6h2.5l-1 3" /></>,
  chat: <><path d="M3.5 4.5h12.5v9H8.5l-5 3.5z" /><path d="M16 8.5h4.5v9.5l-3.5-2.5H10v-2" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  check: <path d="M5 12.5 10 17 19 7" />,
  map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  stairs: <path d="M3 20h5v-4h4v-4h4V8h5" />,
  incline: <><path d="M3 19.5h18V7z" /><path d="M7 19.5v-2" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  route: <><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8 20h8M9.5 17h5" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  bolt: <path d="M13 2.5 4.5 13.5h6.5l-1 8 8.5-11h-6.5z" />,
  bell: <><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1.2" {...fill} /></>,
  send: <path d="M4 12 20 4l-6 16-3-7z" />,
  locate: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="7.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22" /></>,
  walk: <><circle cx="13" cy="4.5" r="1.8" /><path d="M10 21l2-6 3 3v3M12 15l-1.5-5 4-1.5 2 3.5H19M10.5 10 8 12v3" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
  backpack: <><rect x="5" y="7" width="14" height="14" rx="4" /><path d="M9 7V5a3 3 0 0 1 6 0v2M9 14h6" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
  phone: <path d="M5 4h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 6.1 6.1l1.4-2.3L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5C10.7 20 4 13.3 3.5 5.6A1.5 1.5 0 0 1 5 4z" />,
  phoneDown: <path d="M3.2 14.6c-.6-.6-.6-1.6 0-2.2C5.6 10 8.7 8.8 12 8.8s6.4 1.2 8.8 3.6c.6.6.6 1.6 0 2.2l-1.6 1.6a1 1 0 0 1-1.3.1l-2.4-1.8a1 1 0 0 1-.4-.9l.2-1.9a10 10 0 0 0-6.6 0l.2 1.9a1 1 0 0 1-.4.9L6.1 16.3a1 1 0 0 1-1.3-.1z" {...fill} />,
  video: <><rect x="2.5" y="6" width="13" height="12" rx="3" /><path d="m15.5 10.5 6-3.5v10l-6-3.5" /></>,
  videoOff: <><path d="M15.5 13v2a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h1M10 6h2.5a3 3 0 0 1 3 3v1.5l6-3.5v10l-3-1.8" /><path d="M3 3l18 18" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></>,
  micOff: <><path d="M15 10V6a3 3 0 0 0-5.8-1M9 9v2a3 3 0 0 0 4.6 2.5M18.5 11a6.5 6.5 0 0 1-1 3.4M5.5 11a6.5 6.5 0 0 0 10.4 5.2M12 17.5V21M8.5 21h7" /><path d="M3 3l18 18" /></>,
  flip: <><path d="M4 9a8 8 0 0 1 14.5-3.5L20 7M20 3v4h-4" /><path d="M20 15a8 8 0 0 1-14.5 3.5L4 17M4 21v-4h4" /></>,
  userPlus: <><circle cx="9.5" cy="8" r="3.5" /><path d="M3 20c0-3.6 2.9-6.5 6.5-6.5S16 16.4 16 20M19 8v6M16 11h6" /></>,
  minimize: <path d="m6 9 6 6 6-6" />,
  sparkle: <path d="M12 3.5 13.8 10 20.5 12l-6.7 2L12 20.5 10.2 14 3.5 12l6.7-2z" />,
};

export default function Icon({ name, size = 20, className, style, strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
}
