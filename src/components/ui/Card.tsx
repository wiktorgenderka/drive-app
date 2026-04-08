import { ReactNode } from 'react';

interface CardProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function Card({ header, footer, children, className = '' }: CardProps) {
  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-xl overflow-hidden ${className}`}>
      {header && (
        <div className="px-4 py-3 border-b border-gray-700 font-medium text-gray-100">
          {header}
        </div>
      )}
      <div className="p-4">{children}</div>
      {footer && (
        <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/50">
          {footer}
        </div>
      )}
    </div>
  );
}
