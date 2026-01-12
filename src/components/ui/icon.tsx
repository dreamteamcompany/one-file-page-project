import * as Icons from 'lucide-react';
import type { LucideProps } from 'lucide-react';

interface IconProps extends LucideProps {
  name: string;
  fallback?: string;
}

const Icon = ({ name, fallback = 'CircleAlert', ...props }: IconProps) => {
  // @ts-ignore - Dynamic icon access
  const IconComponent = Icons[name];

  if (IconComponent) {
    return <IconComponent {...props} />;
  }

  // @ts-ignore - Dynamic fallback access
  const FallbackIcon = Icons[fallback];
  
  if (FallbackIcon) {
    return <FallbackIcon {...props} />;
  }

  return null;
};

export default Icon;