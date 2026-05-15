interface AvatarProps {
  name: string;
  image?: string | null;
  size?: 'sm' | 'md' | 'lg';
  isOnline?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

const dotSizes = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-4 w-4',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Avatar({ name, image, size = 'md', isOnline, className = '' }: AvatarProps) {
  return (
    <div className={`relative inline-flex ${className}`}>
      {image ? (
        <img
          src={image}
          alt={name}
          loading="lazy"
          className={`${sizeStyles[size]} rounded-full object-cover ring-2 ring-gray-700`}
        />
      ) : (
        <div
          className={`${sizeStyles[size]} rounded-full bg-accent/20 text-accent flex items-center justify-center font-semibold ring-2 ring-gray-700`}
        >
          {getInitials(name)}
        </div>
      )}
      {isOnline !== undefined && (
        <span
          className={`absolute bottom-0 right-0 ${dotSizes[size]} rounded-full border-2 border-gray-800 ${
            isOnline ? 'bg-green-500' : 'bg-gray-500'
          }`}
        />
      )}
    </div>
  );
}
