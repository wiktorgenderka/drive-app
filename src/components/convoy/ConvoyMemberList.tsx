'use client';

interface ConvoyMember {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface ConvoyMemberListProps {
  members: ConvoyMember[];
  onViewOnMap?: (memberId: string) => void;
}

export default function ConvoyMemberList({
  members,
  onViewOnMap,
}: ConvoyMemberListProps) {
  if (members.length === 0) {
    return (
      <p className="py-2 text-center text-xs text-zinc-500">
        No members in this convoy yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {members.map((member) => (
        <li
          key={member.id}
          className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-zinc-800/50"
        >
          {/* Avatar */}
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt={member.name}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-medium text-white">
              {member.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Name */}
          <span className="flex-1 truncate text-sm text-zinc-200">
            {member.name}
          </span>

          {/* View on map */}
          <button
            onClick={() => onViewOnMap?.(member.id)}
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-700 hover:text-blue-400"
            title="View on map"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}
