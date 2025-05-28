import React from 'react';
import { twMerge } from 'tailwind-merge';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card = ({ children, className }: CardProps) => {
  return (
    <div className={twMerge('card p-6', className)}>
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className }: CardProps) => {
  return (
    <div className={twMerge('mb-4', className)}>
      {children}
    </div>
  );
};

export const CardTitle = ({ children, className }: CardProps) => {
  return (
    <h3 className={twMerge('text-lg font-semibold', className)}>
      {children}
    </h3>
  );
};

export const CardDescription = ({ children, className }: CardProps) => {
  return (
    <p className={twMerge('text-sm text-gray-600', className)}>
      {children}
    </p>
  );
};

export const CardContent = ({ children, className }: CardProps) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};

export const CardFooter = ({ children, className }: CardProps) => {
  return (
    <div className={twMerge('mt-4 pt-4 border-t border-gray-200', className)}>
      {children}
    </div>
  );
};

export { Card };
export default Card;