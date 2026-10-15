const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const make = (paths) =>
  function Icon({ size = 20, ...props }) {
    return (
      <svg {...base} width={size} height={size} {...props}>
        {paths}
      </svg>
    );
  };

export const BookIcon = make(
  <>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </>
);
export const DashboardIcon = make(
  <>
    <rect x="3" y="3" width="7" height="9" />
    <rect x="14" y="3" width="7" height="5" />
    <rect x="14" y="12" width="7" height="9" />
    <rect x="3" y="16" width="7" height="5" />
  </>
);
export const IssueIcon = make(
  <>
    <path d="M17 1l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 23l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </>
);
export const RequestIcon = make(
  <>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </>
);
export const LogoutIcon = make(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </>
);
export const MenuIcon = make(
  <>
    <path d="M3 6h18" />
    <path d="M3 12h18" />
    <path d="M3 18h18" />
  </>
);
export const EyeIcon = make(
  <>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </>
);
export const EyeOffIcon = make(
  <>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M1 1l22 22" />
  </>
);
export const CheckIcon = make(<path d="M20 6L9 17l-5-5" />);
export const ClockIcon = make(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </>
);
export const PlusIcon = make(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>
);
export const SearchIcon = make(
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.3-4.3" />
  </>
);
export const EditIcon = make(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </>
);
export const TrashIcon = make(
  <>
    <path d="M3 6h18" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </>
);
export const CloseIcon = make(
  <>
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </>
);
export const ReturnIcon = make(
  <>
    <path d="M9 14L4 9l5-5" />
    <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
  </>
);
export const XIcon = make(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M15 9l-6 6" />
    <path d="M9 9l6 6" />
  </>
);
export const SunIcon = make(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </>
);
export const MoonIcon = make(<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />);