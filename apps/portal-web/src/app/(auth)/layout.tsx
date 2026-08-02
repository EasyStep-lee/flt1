import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
};

export default function AuthenticationLayout({ children }: { readonly children: ReactNode }) {
  return children;
}
